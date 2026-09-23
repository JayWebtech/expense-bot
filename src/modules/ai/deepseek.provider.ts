import OpenAI from 'openai';
import { createHash } from 'crypto';
import { ZodError } from 'zod';
import { config } from '../../config';
import { AIContext, AIResponse, AIResponseSchema } from './ai.types';
import { buildSystemPrompt } from './prompts';
import { AIProviderError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { prisma } from '../../infrastructure/database/client';

/** Strip markdown code fences and extract the first JSON object from a string. */
function extractJSON(raw: string): string {
  // Remove ```json ... ``` or ``` ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Find the first {...} block
  const obj = raw.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return raw.trim();
}

const UNKNOWN_FALLBACK: AIResponse = {
  intent: 'UNKNOWN',
  confidence: 0.5,
  needsConfirmation: false,
  message: "I'm not sure I understood that. Could you try rephrasing? E.g. 'Spent 5k on food' or 'I received 500k salary'.",
};

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
      if (!rawContent) {
        logger.warn({ userId }, 'DeepSeek returned empty response, using UNKNOWN fallback');
        return UNKNOWN_FALLBACK;
      }

      const latencyMs = Date.now() - start;
      let parsed: unknown;
      let validated: AIResponse;

      try {
        parsed = JSON.parse(extractJSON(rawContent));
        validated = AIResponseSchema.parse(parsed);
      } catch (parseErr) {
        // JSON parse error or Zod validation error → degrade gracefully
        logger.warn(
          { rawContent: rawContent.slice(0, 300), userId, err: parseErr instanceof Error ? parseErr.message : String(parseErr) },
          'AI response parse/validation failed — using UNKNOWN fallback',
        );

        await prisma.aIInteraction
          .create({
            data: {
              userId,
              provider: 'deepseek',
              model: config.AI_MODEL,
              inputHash: createHash('sha256').update(message).digest('hex'),
              latencyMs,
              success: false,
              error: parseErr instanceof Error ? parseErr.message : String(parseErr),
            },
          })
          .catch(() => null);

        return UNKNOWN_FALLBACK;
      }

      logger.debug({ latencyMs, intent: validated.intent, confidence: validated.confidence }, 'AI parsed message');

      await prisma.aIInteraction
        .create({
          data: {
            userId,
            provider: 'deepseek',
            model: config.AI_MODEL,
            intent: validated.intent,
            inputHash: createHash('sha256').update(message).digest('hex'),
            output: parsed as any,
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

      // Network errors, auth failures — rethrow so caller can show a retry message
      throw err;
    }
  }
}
