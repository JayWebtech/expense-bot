import { prisma } from '../../infrastructure/database/client';
import { Category } from '@prisma/client';

export class CategoryRepository {
  async findAll(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: {
        OR: [
          { userId: null, isDefault: true, isActive: true, deletedAt: null },
          { userId, isActive: true, deletedAt: null },
        ],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findByName(name: string, userId: string): Promise<Category | null> {
    const userCat = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, userId, isActive: true, deletedAt: null },
    });
    if (userCat) return userCat;

    return prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, userId: null, isDefault: true, isActive: true, deletedAt: null },
    });
  }

  async findOrCreate(name: string, userId: string): Promise<Category> {
    const existing = await this.findByName(name, userId);
    if (existing) return existing;
    return prisma.category.create({
      data: { userId, name, isDefault: false, isActive: true },
    });
  }

  async create(
    userId: string,
    input: { name: string; icon?: string; color?: string; type?: string },
  ): Promise<Category> {
    return prisma.category.create({
      data: { userId, name: input.name, icon: input.icon, color: input.color, type: input.type, isDefault: false, isActive: true },
    });
  }
}

export const categoryRepository = new CategoryRepository();
