import { BotContext } from '../../../infrastructure/telegram/bot';
import { logger } from '../../../shared/logger';

/**
 * Handles free-form text messages. In Phase 1 this is a stub.
 * Full AI-powered intent handling will be wired in Phase 3.
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  logger.debug(
    { userId: ctx.session.userId, textLength: text.length },
    'Received text message',
  );

  // In later phases this will call the AI intent parser.
  // For now, guide the user.
  await ctx.reply(
    '🤖 AI message processing is coming in Phase 3.\n\n' +
      'For now, please use the available commands. Type /help to see them.',
  );
}
