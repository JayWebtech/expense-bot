import { prisma } from '../../infrastructure/database/client';
import { CreateUserInput, UpdateUserInput, UserWithSettings } from './user.types';

export class UserRepository {
  async findByTelegramId(telegramUserId: bigint): Promise<UserWithSettings | null> {
    return prisma.user.findUnique({
      where: { telegramUserId },
      include: { settings: true },
    });
  }

  async findById(id: string): Promise<UserWithSettings | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { settings: true },
    });
  }

  async create(input: CreateUserInput): Promise<UserWithSettings> {
    return prisma.user.create({
      data: {
        telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername,
        firstName: input.firstName,
        lastName: input.lastName,
        timezone: input.timezone ?? 'Africa/Lagos',
        defaultCurrency: input.defaultCurrency ?? 'NGN',
        language: input.language ?? 'en',
        settings: {
          create: {}, // create default settings
        },
      },
      include: { settings: true },
    });
  }

  async upsert(input: CreateUserInput): Promise<UserWithSettings> {
    const existing = await this.findByTelegramId(input.telegramUserId);

    if (existing) {
      return prisma.user.update({
        where: { telegramUserId: input.telegramUserId },
        data: {
          telegramUsername: input.telegramUsername,
          firstName: input.firstName,
          lastName: input.lastName,
        },
        include: { settings: true },
      });
    }

    return this.create(input);
  }

  async update(id: string, input: UpdateUserInput): Promise<UserWithSettings> {
    return prisma.user.update({
      where: { id },
      data: input,
      include: { settings: true },
    });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}

export const userRepository = new UserRepository();
