import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DeepSeekProvider } from './deepseek.provider';
import { AIContext, AIResponse, ConversationMessage } from './ai.types';
import { prisma } from '../../infrastructure/database/client';
import { UserWithSettings } from '../users/user.types';
import { categoryService } from '../categories/category.service';
import { config } from '../../config';
import { logger } from '../../shared/logger';

export class AIService {
  private provider: DeepSeekProvider | null = null;

  isConfigured(): boolean {
    return !!config.DEEPSEEK_API_KEY;
  }

  private getProvider(): DeepSeekProvider {
    if (!this.provider) this.provider = new DeepSeekProvider();
    return this.provider;
  }

  async processMessage(message: string, userId: string, user: UserWithSettings): Promise<AIResponse> {
    const context = await this.getContext(userId);
    const categories = await categoryService.getCategoryNames(userId);

    const tz = user.timezone ?? config.DEFAULT_TIMEZONE;
    const nowInTz = toZonedTime(new Date(), tz);
    const today = format(nowInTz, 'yyyy-MM-dd');
    const yesterday = format(subDays(nowInTz, 1), 'yyyy-MM-dd');

    const aiCtx: AIContext = {
      defaultCurrency: user.defaultCurrency ?? config.DEFAULT_CURRENCY,
      timezone: tz,
      today,
      yesterday,
      categories,
      recentMessages: context,
    };

    const response = await this.getProvider().parseFinancialMessage(message, aiCtx, userId);
    await this.saveContext(userId, message, `[${response.intent}]`);
    return response;
  }

  async getContext(userId: string): Promise<ConversationMessage[]> {
    const conv = await prisma.conversation.findFirst({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conv) return [];
    const ctx = conv.context as { messages?: Array<{ role: string; content: string; timestamp: string }> };
    const msgs = ctx?.messages ?? [];
    return msgs.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }));
  }

  async saveContext(userId: string, userMessage: string, assistantSummary: string): Promise<void> {
    const existing = await this.getContext(userId);
    const messages: ConversationMessage[] = ([
      ...existing,
      { role: 'user' as const, content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: assistantSummary, timestamp: new Date().toISOString() },
    ] as ConversationMessage[]).slice(-10);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    try {
      await prisma.conversation.deleteMany({ where: { userId } });
      await prisma.conversation.create({ data: { userId, context: { messages } as any, expiresAt } });
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to save conversation context');
    }
  }
}

export const aiService = new AIService();
