import { User, UserSetting } from '@prisma/client';

export type { User, UserSetting };

export interface CreateUserInput {
  telegramUserId: bigint;
  telegramUsername?: string;
  firstName: string;
  lastName?: string;
  timezone?: string;
  defaultCurrency?: string;
  language?: string;
}

export interface UpdateUserInput {
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  defaultCurrency?: string;
  language?: string;
}

export interface UserWithSettings extends User {
  settings: UserSetting | null;
}
