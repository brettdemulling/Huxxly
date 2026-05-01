import type { IMealPlanRepository, MealPlanEntity } from '@/lib/contracts';

// Stub — wired to full Prisma implementation once the meal plan schema stabilizes.
export const MealPlanRepository: IMealPlanRepository = {
  async create(_plan: Omit<MealPlanEntity, 'id'>): Promise<MealPlanEntity> {
    throw new Error('MealPlanRepository.create: not yet implemented — use /api/mealplan/generate');
  },

  async findLatestByUser(_userId: string): Promise<MealPlanEntity | null> {
    return null;
  },
};
