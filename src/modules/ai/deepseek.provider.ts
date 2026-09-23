import OpenAI from 'openai';
import { createHash } from 'crypto';
import { config } from '../../config';
import { AIContext, AIResponse, AIResponseSchema } from './ai.types';
import { buildSystemPrompt } from './prompts';
import { AIProviderError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { prisma } from '../../infrastructure/database/client';

export class DeepSeekProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.DEEPSEEK_API_KEY!,
      baseURL: config.DEEPSEEK_BASE_URL,
    });
  }

  async parseFinancialMessage(message: string, ctx: AIContext, userId: string): Promise<AIResponse> {
    const systemPrompt = buildSystemPrompt(ctx);
    const start = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...ctx.recentMessages.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    let rawContent = '';

    try {
      const completion = await this.client.chat.completions.create({
        model: config.AI_MODEL,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      });

      rawContent = completion.choices[0]?.message?.content ?? '';
      if (!rawContent) throw new AIProviderError('Empty response from DeepSeek');

      const parsed = JSON.parse(rawContent);
      const validated = AIResponseSchema.parse(parsed);
      const latencyMs = Date.now() - start;

      logger.debug({ latencyMs, intent: validated.intent, confidence: validated.confidence }, 'AI parsed message');

      await prisma.aIInteraction
        .create({
          data: {
            userId,
            provider: 'deepseek',
            model: config.AI_MODEL,
            intent: validated.intent,
            inputHash: createHash('sha256').update(message).digest('hex'),
            output: parsed,
            tokens: completion.usage?.total_tokens ?? null,
            latencyMs,
            success: true,
          },
        })
        .catch(() => null);

      return validated;
    } catch (err) {
      const latencyMs = Date.now() - start;

      await prisma.aIInteraction
        .create({
          data: {
            userId,
            provider: 'deepseek',
            model: config.AI_MODEL,
            inputHash: createHash('sha256').update(message).digest('hex'),
            latencyMs,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => null);

      if (err instanceof SyntaxError) {
        logger.warn({ rawContent, userId }, 'AI returned invalid JSON');
        throw new AIProviderError(`AI returned invalid JSON`);
      }
      throw err;
    }
  }
}
