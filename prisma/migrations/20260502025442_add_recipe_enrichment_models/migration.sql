-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "deviceUserAgent" TEXT,
    "deviceIp" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "zipCode" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "dietaryFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mealCount" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "prepTimeMinutes" INTEGER NOT NULL,
    "cookTimeMinutes" INTEGER NOT NULL,
    "dietaryFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedCostCents" INTEGER NOT NULL,
    "ingredientsJson" JSONB NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealId" TEXT,
    "provider" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "estimatedDeliveryFee" INTEGER NOT NULL,
    "estimatedTotalCents" INTEGER NOT NULL,
    "checkoutUrl" TEXT,
    "missingIngredients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverageScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pastIntents" JSONB NOT NULL DEFAULT '[]',
    "acceptedMeals" JSONB NOT NULL DEFAULT '[]',
    "rejectedSubs" JSONB NOT NULL DEFAULT '[]',
    "dietaryPatterns" JSONB NOT NULL DEFAULT '{}',
    "budgetBehavior" JSONB NOT NULL DEFAULT '{}',
    "preferredStores" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zipCode" TEXT,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "imageUrl" TEXT,
    "servings" INTEGER,
    "description" TEXT,
    "cuisine" TEXT,
    "cookTimeMinutes" INTEGER,
    "prepTimeMinutes" INTEGER,
    "calories" INTEGER,
    "externalId" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measure" TEXT,
    "normalized" TEXT,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_instructions" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "recipe_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_nutrition" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "calories" INTEGER,
    "proteinG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sodiumMg" DOUBLE PRECISION,

    CONSTRAINT "recipe_nutrition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_views" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "userId" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_recipes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_plan_items" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT NOT NULL,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "grocery_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_store_selections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_store_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountTotal" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "lineItemsJson" JSONB NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "intents_userId_idx" ON "intents"("userId");

-- CreateIndex
CREATE INDEX "meals_intentId_idx" ON "meals"("intentId");

-- CreateIndex
CREATE INDEX "carts_userId_idx" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_profiles_userId_key" ON "memory_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_flowId_step_key" ON "checkpoints"("flowId", "step");

-- CreateIndex
CREATE INDEX "jobs_status_runAt_idx" ON "jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "events_userId_type_idx" ON "events"("userId", "type");

-- CreateIndex
CREATE INDEX "events_timestamp_idx" ON "events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_externalId_key" ON "recipes"("externalId");

-- CreateIndex
CREATE INDEX "recipes_category_idx" ON "recipes"("category");

-- CreateIndex
CREATE INDEX "recipes_externalId_idx" ON "recipes"("externalId");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipeId_idx" ON "recipe_ingredients"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_instructions_recipeId_idx" ON "recipe_instructions"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_nutrition_recipeId_key" ON "recipe_nutrition"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_views_recipeId_idx" ON "recipe_views"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_views_createdAt_idx" ON "recipe_views"("createdAt");

-- CreateIndex
CREATE INDEX "search_queries_createdAt_idx" ON "search_queries"("createdAt");

-- CreateIndex
CREATE INDEX "saved_recipes_userId_idx" ON "saved_recipes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_recipes_userId_recipeId_key" ON "saved_recipes"("userId", "recipeId");

-- CreateIndex
CREATE INDEX "meal_plans_userId_idx" ON "meal_plans"("userId");

-- CreateIndex
CREATE INDEX "meal_plan_items_mealPlanId_idx" ON "meal_plan_items"("mealPlanId");

-- CreateIndex
CREATE INDEX "grocery_stores_zipCode_idx" ON "grocery_stores"("zipCode");

-- CreateIndex
CREATE INDEX "user_store_selections_userId_idx" ON "user_store_selections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_store_selections_userId_key" ON "user_store_selections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripeSessionId_key" ON "orders"("stripeSessionId");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intents" ADD CONSTRAINT "intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "intents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_profiles" ADD CONSTRAINT "memory_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_instructions" ADD CONSTRAINT "recipe_instructions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_nutrition" ADD CONSTRAINT "recipe_nutrition_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_views" ADD CONSTRAINT "recipe_views_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_recipes" ADD CONSTRAINT "saved_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
