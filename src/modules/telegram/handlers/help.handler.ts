import { BotContext } from '../../../infrastructure/telegram/bot';
import { InlineKeyboard } from 'grammy';

export async function handleHelp(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('💰 Record Expense', 'help_expense')
    .text('💵 Record Income', 'help_income')
    .row()
    .text('📊 View Reports', 'help_reports')
    .text('🔔 Reminders', 'help_reminders');

  await ctx.reply(
    `📚 *Expense Bot — Help Guide*\n\n` +
      `*Recording Transactions (natural language):*\n` +
      `• _Spent ₦15,000 on fuel_\n` +
      `• _Received 500k salary today_\n` +
      `• _Bought food for 3500 yesterday_\n` +
      `• _I spent 20k on groceries and 5k on transport_\n\n` +
      `*Asking Questions:*\n` +
      `• _How much did I spend this month?_\n` +
      `• _What's my current balance?_\n` +
      `• _Show me my spending by category_\n\n` +
      `*Commands:*\n` +
      `/balance — Current balance\n` +
      `/summary — Monthly summary\n` +
      `/expenses — Recent expenses\n` +
      `/income — Recent income\n` +
      `/report — Generate PDF report\n` +
      `/export — Export as CSV\n` +
      `/categories — Manage categories\n` +
      `/budget — View/set budgets\n` +
      `/reminders — Manage reminders\n` +
      `/settings — Account settings\n` +
      `/cancel — Cancel current action\n\n` +
      `*Voice Notes:*\n` +
      `Send a voice message — I'll transcribe and record it automatically.\n\n` +
      `*Tips:*\n` +
      `• I understand k = ₦1,000 (e.g. "5k" = ₦5,000)\n` +
      `• Dates like "yesterday", "last Friday" work naturally\n` +
      `• I detect duplicate transactions automatically`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    },
  );
}
