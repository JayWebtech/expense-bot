import { BotContext } from '../../../infrastructure/telegram/bot';

export async function handleUnknownCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "I don't recognize that command. Type /help to see what I can do, or just send me a message like:\n\n" +
      '_"Spent ₦5,000 on lunch"_',
    { parse_mode: 'Markdown' },
  );
}
