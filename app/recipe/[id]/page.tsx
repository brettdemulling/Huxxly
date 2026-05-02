import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { resolveImage } from '@/lib/media/imageResolver';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: PageProps) {
  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      instructions: { orderBy: { step: 'asc' } },
      nutrition: true,
    },
  });

  if (!recipe) notFound();

  const image = resolveImage({
    imageUrl: recipe.imageUrl ?? undefined,
    tags: recipe.tags,
    category: recipe.category,
    cuisine: recipe.cuisine ?? undefined,
    title: recipe.name,
  });

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Back nav */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-xs font-medium w-fit"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to recipes
      </Link>

      {/* Hero image */}
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{ height: '240px', background: 'var(--color-bg-secondary)' }}
      >
        <img
          src={image}
          alt={recipe.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-xl font-semibold leading-snug"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {recipe.name}
          </h1>
          <span
            className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full capitalize"
            style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
          >
            {recipe.category}
          </span>
        </div>

        {/* Meta strip */}
        <div
          className="flex items-center gap-4 mt-3 flex-wrap"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {recipe.cuisine && (
            <span className="text-xs">{recipe.cuisine}</span>
          )}
          {recipe.cookTimeMinutes && (
            <span className="flex items-center gap-1 text-xs">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
              {recipe.cookTimeMinutes} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1 text-xs">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              Serves {recipe.servings}
            </span>
          )}
          {recipe.calories && (
            <span className="flex items-center gap-1 text-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8 8 8 12 12 14c-1-3 1-5 3-6-1 4 2 6 2 10a6 6 0 0 1-12 0c0-5 4-8 5-12 1 3 2 5 2 8z" />
              </svg>
              {recipe.calories} cal
            </span>
          )}
        </div>

        {/* Price */}
        <p
          className="text-2xl font-bold mt-3"
          style={{ color: 'var(--color-primary)' }}
        >
          ${recipe.price.toFixed(2)}
          {recipe.servings && recipe.servings > 0 && (
            <span className="text-sm font-normal ml-1.5" style={{ color: 'var(--color-text-muted)' }}>
              · ${(recipe.price / recipe.servings).toFixed(2)}/serving
            </span>
          )}
        </p>
      </div>

      {/* Description */}
      {recipe.description && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {recipe.description}
        </p>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-muted)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <div>
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Ingredients
          </h2>
          <ul className="flex flex-col gap-2">
            {recipe.ingredients.map((ing) => (
              <li
                key={ing.id}
                className="flex items-start gap-2 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span
                  className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
                  style={{ background: 'var(--color-primary)' }}
                />
                <span>
                  {ing.measure ? `${ing.measure} ${ing.name}` : ing.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      {recipe.instructions.length > 0 && (
        <div>
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Instructions
          </h2>
          <ol className="flex flex-col gap-4">
            {recipe.instructions.map((s) => (
              <li key={s.id} className="flex gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  {s.step}
                </span>
                <p
                  className="text-sm leading-relaxed pt-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nutrition (if available) */}
      {recipe.nutrition && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-secondary)' }}
        >
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Nutrition per serving
          </h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Calories', value: recipe.nutrition.calories?.toString() ?? null },
              { label: 'Protein',  value: recipe.nutrition.proteinG  ? `${recipe.nutrition.proteinG}g`  : null },
              { label: 'Carbs',    value: recipe.nutrition.carbsG    ? `${recipe.nutrition.carbsG}g`    : null },
              { label: 'Fat',      value: recipe.nutrition.fatG      ? `${recipe.nutrition.fatG}g`      : null },
            ].filter(({ value }) => value !== null).map(({ label, value }) => (
              <div key={label}>
                <p className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
