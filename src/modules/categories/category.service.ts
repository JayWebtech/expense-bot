import { categoryRepository } from './category.repository';
import { Category } from '@prisma/client';
import { CATEGORY_ICONS } from '../../shared/types';

export class CategoryService {
  async getAllForUser(userId: string): Promise<Category[]> {
    return categoryRepository.findAll(userId);
  }

  async findByName(name: string, userId: string): Promise<Category | null> {
    return categoryRepository.findByName(name, userId);
  }

  async findOrCreate(name: string, userId: string): Promise<Category> {
    return categoryRepository.findOrCreate(name, userId);
  }

  async create(
    userId: string,
    input: { name: string; icon?: string; color?: string; type?: string },
  ): Promise<Category> {
    return categoryRepository.create(userId, input);
  }

  async getCategoryNames(userId: string): Promise<string[]> {
    const cats = await categoryRepository.findAll(userId);
    return cats.map((c) => c.name);
  }

  getCategoryIcon(name: string): string {
    return CATEGORY_ICONS[name] ?? '📌';
  }
}

export const categoryService = new CategoryService();
