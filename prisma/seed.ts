import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RECIPES = [
  {
    name: 'Spaghetti Bolognese',
    price: 18.50,
    category: 'pasta',
    tags: ['italian', 'beef', 'comfort-food'],
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 4,
  },
  {
    name: 'Margherita Pizza',
    price: 14.00,
    category: 'pizza',
    tags: ['italian', 'vegetarian', 'cheese'],
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Pan-Seared Salmon',
    price: 26.00,
    category: 'seafood',
    tags: ['fish', 'healthy', 'omega-3', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Caesar Salad',
    price: 11.00,
    category: 'salad',
    tags: ['vegetarian', 'light', 'lunch'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Chicken Noodle Soup',
    price: 13.50,
    category: 'soup',
    tags: ['chicken', 'comfort-food', 'winter'],
    imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 4,
  },
  {
    name: 'Street Tacos',
    price: 16.00,
    category: 'mexican',
    tags: ['beef', 'spicy', 'quick'],
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 3,
  },
  {
    name: 'Salmon Sushi Rolls',
    price: 22.00,
    category: 'japanese',
    tags: ['sushi', 'fish', 'rice', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Ribeye Steak',
    price: 38.00,
    category: 'beef',
    tags: ['steak', 'dinner', 'keto', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Vegetable Stir Fry',
    price: 12.00,
    category: 'asian',
    tags: ['vegan', 'vegetables', 'quick', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 3,
  },
  {
    name: 'Grilled Chicken Breast',
    price: 17.00,
    category: 'chicken',
    tags: ['high-protein', 'gluten-free', 'healthy', 'keto'],
    imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Classic Cheeseburger',
    price: 15.50,
    category: 'american',
    tags: ['beef', 'comfort-food', 'quick'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'BBQ Pork Ribs',
    price: 32.00,
    category: 'bbq',
    tags: ['pork', 'smoky', 'weekend', 'gluten-free'],
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76538dc82e9?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 4,
  },
  {
    name: 'Poke Bowl',
    price: 19.00,
    category: 'hawaiian',
    tags: ['fish', 'rice', 'healthy', 'fresh'],
    imageUrl: 'https://images.unsplash.com/photo-1584776851497-51438b804e6f?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 1,
  },
  {
    name: 'Tonkotsu Ramen',
    price: 21.00,
    category: 'japanese',
    tags: ['noodles', 'pork', 'broth', 'comfort-food'],
    imageUrl: 'https://images.unsplash.com/photo-1571167530149-c1105da4c285?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Pasta Carbonara',
    price: 17.50,
    category: 'pasta',
    tags: ['italian', 'eggs', 'bacon', 'quick'],
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Avocado Toast',
    price: 9.00,
    category: 'breakfast',
    tags: ['vegan', 'healthy', 'quick', 'vegetarian'],
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414f2005?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 1,
  },
  {
    name: 'Greek Salad',
    price: 12.50,
    category: 'salad',
    tags: ['mediterranean', 'vegetarian', 'feta', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1515516969354-50de00cda48c?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Beef & Vegetable Stew',
    price: 22.00,
    category: 'soup',
    tags: ['beef', 'comfort-food', 'winter', 'slow-cook'],
    imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 6,
  },
  {
    name: 'Shrimp Pad Thai',
    price: 20.00,
    category: 'asian',
    tags: ['shrimp', 'noodles', 'thai', 'spicy'],
    imageUrl: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 2,
  },
  {
    name: 'Mushroom Risotto',
    price: 18.00,
    category: 'italian',
    tags: ['vegetarian', 'mushroom', 'rice', 'comfort-food'],
    imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&w=400&h=300&fit=crop&q=80',
    servings: 3,
  },
];

async function main() {
  console.log('[seed] Seeding recipes...');

  await prisma.recipe.deleteMany({});

  for (const recipe of RECIPES) {
    await prisma.recipe.create({ data: recipe });
  }

  console.log(`[seed] Created ${RECIPES.length} recipes.`);
}

main()
  .catch((e) => { console.error('[seed] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
