import { BotContext } from '../../../infrastructure/telegram/bot';

export async function handleCancel(ctx: BotContext): Promise<void> {
  // Clear any pending confirmation or onboarding state
  ctx.session.awaitingConfirmation = undefined;
  ctx.session.onboardingStep = undefined;

  await ctx.reply('✅ Action cancelled. What would you like to do?', {
    reply_markup: { remove_keyboard: true },
  });
}
