import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../../infrastructure/telegram/bot';
import { voiceService } from '../../voice/voice.service';
import { logger } from '../../../shared/logger';
import { VoiceTranscriptionError } from '../../../shared/errors';
import { config } from '../../../config';

export async function handleVoiceMessage(ctx: BotContext): Promise<void> {
  const voice = ctx.message?.voice ?? ctx.message?.audio;
  if (!voice) return;

  if (config.STT_PROVIDER === 'mock' || !config.DEEPGRAM_API_KEY) {
    await ctx.reply(
      '🎤 Voice notes require Deepgram to be configured.\n\n' +
        'Set `STT_PROVIDER=deepgram` and `DEEPGRAM_API_KEY` in your environment, then try again.',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const processingMsg = await ctx.reply('🎤 Transcribing your voice note...');

  try {
    logger.info(
      { userId: ctx.session.userId, duration: voice.duration, fileId: voice.file_id },
      'Processing voice message',
    );

    const result = await voiceService.transcribeFromTelegram(voice.file_id);

    // Delete the "transcribing..." message
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);

    if (!result.text) {
      await ctx.reply(
        "🎤 I couldn't make out any words in that voice note. Please try again or type your transaction.",
      );
      return;
    }

    const confidenceEmoji = result.confidence >= 0.9 ? '✅' : result.confidence >= 0.7 ? '⚠️' : '❓';
    const confidencePct = Math.round(result.confidence * 100);

    const keyboard = new InlineKeyboard()
      .text('✅ Process this', `voice_process:${ctx.message!.message_id}`)
      .text('❌ Cancel', 'cancel');

    await ctx.reply(
      `🎤 *I heard:*\n\n_"${result.text}"_\n\n` +
        `${confidenceEmoji} Confidence: ${confidencePct}%\n\n` +
        `AI transaction parsing will be available in the next phase.\n` +
        `For now, you can copy the text above and send it as a message.`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      },
    );

    logger.info(
      { userId: ctx.session.userId, confidence: result.confidence, textLength: result.text.length },
      'Voice message transcribed',
    );
  } catch (err) {
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);

    if (err instanceof VoiceTranscriptionError) {
      logger.warn({ err, userId: ctx.session.userId }, 'Voice transcription failed');
      await ctx.reply(
        '🎤 Sorry, I had trouble processing that voice note. Please try again or type your transaction.',
      );
    } else {
      logger.error({ err, userId: ctx.session.userId }, 'Unexpected error in voice handler');
      await ctx.reply('Something went wrong. Please try again in a moment.');
    }
  }
}
