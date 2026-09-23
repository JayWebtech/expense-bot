import { BotContext } from '../../infrastructure/telegram/bot';

/**
 * Sends a "typing..." indicator and keeps refreshing it every 4s until stop() is called.
 * Telegram's typing action expires after ~5s, so we re-send before it drops.
 */
export function startTyping(ctx: BotContext): () => void {
  const chatId = ctx.chat?.id;
  if (!chatId) return () => {};

  void ctx.api.sendChatAction(chatId, 'typing').catch(() => {});

  const interval = setInterval(() => {
    void ctx.api.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);

  return () => clearInterval(interval);
}
