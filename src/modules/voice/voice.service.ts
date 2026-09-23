import { getSttProvider } from '../../infrastructure/stt/factory';
import { TranscribeResult } from '../../infrastructure/stt/index';
import { VoiceTranscriptionError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { config } from '../../config';

export class VoiceService {
  /**
   * Download a Telegram voice/audio file and transcribe it with Deepgram.
   * The audio buffer is never stored — it lives only in memory during this call.
   */
  async transcribeFromTelegram(fileId: string): Promise<TranscribeResult> {
    const buffer = await this.downloadTelegramFile(fileId);
    const stt = getSttProvider();
    return stt.transcribe(buffer, 'audio/ogg');
  }

  private async downloadTelegramFile(fileId: string): Promise<Buffer> {
    const token = config.TELEGRAM_BOT_TOKEN;

    // Step 1: resolve file_path from Telegram
    const infoRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
    );
    if (!infoRes.ok) {
      throw new VoiceTranscriptionError('Failed to fetch file info from Telegram');
    }

    const info = (await infoRes.json()) as {
      ok: boolean;
      result?: { file_path: string };
    };

    if (!info.ok || !info.result?.file_path) {
      throw new VoiceTranscriptionError('Telegram getFile returned no file_path');
    }

    // Step 2: download the audio bytes
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${info.result.file_path}`;
    const audioRes = await fetch(downloadUrl);
    if (!audioRes.ok) {
      throw new VoiceTranscriptionError('Failed to download audio from Telegram');
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.debug({ fileId, bytes: buffer.length }, 'Voice audio downloaded from Telegram');
    return buffer;
  }
}

export const voiceService = new VoiceService();
