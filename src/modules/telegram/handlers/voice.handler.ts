import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { voiceService } from '../../voice/voice.service';
import { aiService } from '../../ai/ai.service';
import { handleTextMessage } from './text.handler';
import { logger } from '../../../shared/logger';
import { VoiceTranscriptionError } from '../../../shared/errors';
import { config } from '../../../config';

export async function handleVoiceMessage(ctx: BotContext): Promise<void> {
  const voice = ctx.message?.voice ?? ctx.message?.audio;
  if (!voice) return;

  const telegramUser = ctx.from;
  if (!telegramUser) return;

  if (config.STT_PROVIDER === 'mock' || !config.DEEPGRAM_API_KEY) {
    await ctx.reply(
      '🎤 Voice notes require Deepgram to be configured.\n\nSet `STT_PROVIDER=deepgram` and `DEEPGRAM_API_KEY` in your environment.',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const processingMsg = await ctx.reply('🎤 Transcribing...');

  try {
    const user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
    ctx.session.userId = user.id;

    logger.info({ userId: user.id, duration: voice.duration }, 'Processing voice message');

    const result = await voiceService.transcribeFromTelegram(voice.file_id);
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);

    if (!result.text) {
      await ctx.reply("🎤 I couldn't make out any words. Please try again or type your transaction.");
      return;
    }

    const confidenceEmoji = result.confidence >= 0.9 ? '✅' : result.confidence >= 0.7 ? '⚠️' : '❓';
    const confidencePct = Math.round(result.confidence * 100);

    // If AI is configured, process the transcription automatically
    if (aiService.isConfigured()) {
      await ctx.reply(
        `🎤 _"${result.text}"_\n${confidenceEmoji} ${confidencePct}% confidence — processing...`,
        { parse_mode: 'Markdown' },
      );

      // Pass the real ctx with transcribed text as override — spreading ctx would lose prototype methods
      await handleTextMessage(ctx, result.text);
    } else {
      const keyboard = new InlineKeyboard()
        .text('Process this', `voice_confirm`)
        .text('Cancel', 'cancel');

      await ctx.reply(
        `🎤 *I heard:*\n\n_"${result.text}"_\n\n${confidenceEmoji} Confidence: ${confidencePct}%\n\n` +
          `_Configure DeepSeek to process voice notes automatically._`,
        { parse_mode: 'Markdown', reply_markup: keyboard },
      );
    }

    logger.info({ userId: user.id, confidence: result.confidence }, 'Voice message transcribed');
  } catch (err) {
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);

    if (err instanceof VoiceTranscriptionError) {
      logger.warn({ err }, 'Voice transcription failed');
      await ctx.reply('🎤 Sorry, I had trouble processing that voice note. Please try again or type your transaction.');
    } else {
      logger.error({ err }, 'Unexpected error in voice handler');
      await ctx.reply('Something went wrong. Please try again in a moment.');
    }
  }
}
