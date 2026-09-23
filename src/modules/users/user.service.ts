import { userRepository } from './user.repository';
import { CreateUserInput, UpdateUserInput, UserWithSettings } from './user.types';
import { NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export class UserService {
  async findOrCreateFromTelegram(input: CreateUserInput): Promise<UserWithSettings> {
    logger.debug({ telegramUserId: input.telegramUserId.toString() }, 'Finding or creating user');
    return userRepository.upsert(input);
  }

  async getById(id: string): Promise<UserWithSettings> {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async getByTelegramId(telegramUserId: bigint): Promise<UserWithSettings> {
    const user = await userRepository.findByTelegramId(telegramUserId);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserWithSettings> {
    await this.getById(id); // ensure exists
    return userRepository.update(id, input);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.getById(id); // ensure exists
    await userRepository.softDelete(id);
    logger.info({ userId: id }, 'User account soft-deleted');
  }
}

export const userService = new UserService();
