// ─── Vercel Deployment Failure Detector ───────────────────────────────────────
// Static analysis only. No network calls. No app imports.
// Run: npm run verify:vercel

import * as fs from 'fs';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const SCAN_DIRS = ['lib', 'app', 'components', 'prisma'];

const CRITICAL_ENV_VARS = [
  'DATABASE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'ANTHROPIC_API_KEY',
  'SESSION_SECRET',
  'IRON_SESSION_PASSWORD',
  'NEXT_PUBLIC_APP_URL',
];

const TOP_LEVEL_RISK_CTORS = [
  'new Redis',
  'new PrismaClient',
  'new Anthropic',
  'new Client(',
  'new Ratelimit',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Issue {
  category: 'ENV_CRASH' | 'SECRET_MISCONFIG' | 'RISKY';
  severity: 'CRITICAL' | 'WARNING';
  file: string;
  line: number;
  code: string;
  fix: string;
}

// ─── File walker ──────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function rel(abs: string): string {
  return abs.replace(ROOT + '/', '');
}

// ─── Heuristic: is this line at module (top) level? ──────────────────────────
// Counts net brace depth from top of file down to the line.
// Depth 0 = module scope; depth >= 1 = inside a function/class/block.

function getModuleDepthMap(lines: string[]): number[] {
  const depths: number[] = [];
  let depth = 0;
  for (const line of lines) {
    depths.push(depth);
    // Count braces but skip string literals crudely
    const stripped = line.replace(/(['"`]).*?\1/g, '""');
    for (const ch of stripped) {
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  return depths;
}

// ─── Detectors ────────────────────────────────────────────────────────────────

function detectUnsafeEnvBang(lines: string[], filePath: string, depths: number[]): Issue[] {
  const issues: Issue[] = [];
  const re = /process\.env\.(\w+)!/g;
  lines.forEach((line, i) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      const varName = m[1];
      const isTopLevel = depths[i] === 0;
      issues.push({
        category: 'ENV_CRASH',
        severity: 'CRITICAL',
        file: rel(filePath),
        line: i + 1,
        code: line.trim(),
        fix: isTopLevel
          ? `Replace process.env.${varName}! with process.env.${varName} ?? '' and guard before use — top-level crash will break Vercel build.`
          : `Replace process.env.${varName}! with a guarded read (??fallback or runtime throw) to avoid silent undefined coercion.`,
      });
    }
  });
  return issues;
}

function detectUnguardedCriticalEnv(lines: string[], filePath: string): Issue[] {
  const issues: Issue[] = [];
  for (const varName of CRITICAL_ENV_VARS) {
    const re = new RegExp(`process\\.env\\.${varName}(?!\\s*[!?|&])`, 'g');
    lines.forEach((line, i) => {
      re.lastIndex = 0;
      if (re.exec(line)) {
        // Skip if line has ?? or || or || on same line after the reference
        const afterRef = line.slice(line.indexOf(`process.env.${varName}`) + `process.env.${varName}`.length);
        const isGuarded = /^\s*(\?\?|\|\||&&|!)/.test(afterRef) || /\?\?|\|\|/.test(afterRef);
        if (!isGuarded) {
          issues.push({
            category: 'ENV_CRASH',
            severity: 'CRITICAL',
            file: rel(filePath),
            line: i + 1,
            code: line.trim(),
            fix: `Add ?? fallback: process.env.${varName} ?? '' or throw a descriptive error if missing at runtime.`,
          });
        }
      }
    });
  }
  return issues;
}

function detectSecretReferences(lines: string[], filePath: string): Issue[] {
  const issues: Issue[] = [];
  // Vercel secret references use @ prefix in .env files; if they appear in TS code they are invalid
  const re = /@(database_url|upstash|qstash|anthropic|secret|redis|session|iron)/gi;
  lines.forEach((line, i) => {
    re.lastIndex = 0;
    if (re.exec(line)) {
      issues.push({
        category: 'SECRET_MISCONFIG',
        severity: 'CRITICAL',
        file: rel(filePath),
        line: i + 1,
        code: line.trim(),
        fix: 'Remove Vercel secret reference syntax (@name) from TypeScript source — use process.env.VAR directly.',
      });
    }
  });
  return issues;
}

function detectTopLevelRiskyInit(lines: string[], filePath: string, depths: number[]): Issue[] {
  const issues: Issue[] = [];
  lines.forEach((line, i) => {
    if (depths[i] !== 0) return;
    const hasRiskyCtor = TOP_LEVEL_RISK_CTORS.some((ctor) => line.includes(ctor));
    const hasEnvRef = /process\.env\./.test(line);
    if (hasRiskyCtor && hasEnvRef) {
      issues.push({
        category: 'ENV_CRASH',
        severity: 'CRITICAL',
        file: rel(filePath),
        line: i + 1,
        code: line.trim(),
        fix: 'Wrap in a lazy getter function (e.g. getRedis()) so initialization runs at call time, not module load.',
      });
    } else if (hasRiskyCtor) {
      issues.push({
        category: 'RISKY',
        severity: 'WARNING',
        file: rel(filePath),
        line: i + 1,
        code: line.trim(),
        fix: 'Module-level service initialization — verify env vars are present or move into a lazy initializer.',
      });
    }
  });
  return issues;
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

function dedup(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((iss) => {
    const key = `${iss.file}:${iss.line}:${iss.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const start = Date.now();
  const allIssues: Issue[] = [];
  let scannedCount = 0;

  for (const dir of SCAN_DIRS) {
    const files = walkDir(path.join(ROOT, dir));
    for (const filePath of files) {
      scannedCount++;
      const src = fs.readFileSync(filePath, 'utf-8');
      const lines = src.split('\n');
      const depths = getModuleDepthMap(lines);

      allIssues.push(...detectUnsafeEnvBang(lines, filePath, depths));
      allIssues.push(...detectUnguardedCriticalEnv(lines, filePath));
      allIssues.push(...detectSecretReferences(lines, filePath));
      allIssues.push(...detectTopLevelRiskyInit(lines, filePath, depths));
    }
  }

  const issues = dedup(allIssues);
  const elapsed = Date.now() - start;

  const envCrash = issues.filter((i) => i.category === 'ENV_CRASH');
  const secretMisconfig = issues.filter((i) => i.category === 'SECRET_MISCONFIG');
  const risky = issues.filter((i) => i.category === 'RISKY');
  const criticalCount = envCrash.length + secretMisconfig.length;

  // ─── Output ─────────────────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Vercel Deployment Failure Detector');
  console.log(`  Scanned ${scannedCount} files in ${elapsed}ms`);
  console.log('══════════════════════════════════════════════════════\n');

  if (envCrash.length > 0) {
    console.log('━━━ 1. ENV CRASH ISSUES ─────────────────────────────\n');
    for (const iss of envCrash) {
      console.log(`  ❌ CRITICAL  ${iss.file}:${iss.line}`);
      console.log(`     Code:  ${iss.code}`);
      console.log(`     Fix:   ${iss.fix}`);
      console.log();
    }
  }

  if (secretMisconfig.length > 0) {
    console.log('━━━ 2. SECRET MISCONFIG ─────────────────────────────\n');
    for (const iss of secretMisconfig) {
      console.log(`  ❌ VERCEL SECRET REFERENCE DETECTED  ${iss.file}:${iss.line}`);
      console.log(`     Code:  ${iss.code}`);
      console.log(`     Fix:   ${iss.fix}`);
      console.log();
    }
  }

  if (risky.length > 0) {
    console.log('━━━ 3. SAFE BUT RISKY FILES ─────────────────────────\n');
    for (const iss of risky) {
      console.log(`  ⚠️  WARNING  ${iss.file}:${iss.line}`);
      console.log(`     Code:  ${iss.code}`);
      console.log(`     Fix:   ${iss.fix}`);
      console.log();
    }
  }

  console.log('══════════════════════════════════════════════════════');
  if (criticalCount === 0) {
    console.log('  ✅ VERCEL DEPLOY SAFE');
    console.log(`     No critical issues found. ${risky.length} advisory warning(s).`);
  } else {
    console.log('  ❌ VERCEL DEPLOY WILL FAIL');
    console.log(`     ${envCrash.length} env crash issue(s)  |  ${secretMisconfig.length} secret misconfig(s)  |  ${risky.length} warning(s)`);
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(criticalCount > 0 ? 1 : 0);
}

main();
