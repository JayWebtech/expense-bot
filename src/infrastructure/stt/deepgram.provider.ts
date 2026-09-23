import { DeepgramClient } from '@deepgram/sdk';
import { SpeechToTextProvider, TranscribeResult } from './index';
import { VoiceTranscriptionError } from '../../shared/errors';
import { logger } from '../../shared/logger';

interface DeepgramAlternative {
  transcript?: string;
  confidence?: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: DeepgramAlternative[];
    }>;
  };
}

export class DeepgramProvider implements SpeechToTextProvider {
  private client: DeepgramClient;

  constructor(apiKey: string) {
    // SDK v5 uses { apiKey } options object, not a raw string
    this.client = new DeepgramClient({ apiKey });
  }

  async transcribe(audio: Buffer): Promise<TranscribeResult> {
    const start = Date.now();

    // HttpResponsePromise<T> extends Promise<T> — await resolves to MediaTranscribeResponse
    const body = await this.client.listen.v1.media.transcribeFile(audio, {
      model: 'nova-3',
      language: 'en',
      smart_format: true,
      punctuate: true,
    }) as DeepgramResponse;
    const latencyMs = Date.now() - start;

    const alternative = body?.results?.channels?.[0]?.alternatives?.[0];
    if (!alternative) {
      throw new VoiceTranscriptionError('No transcription returned by Deepgram');
    }

    const text = (alternative.transcript ?? '').trim();
    const confidence = alternative.confidence ?? 0;

    logger.debug(
      { latencyMs, confidence, textLength: text.length },
      'Deepgram transcription complete',
    );

    return {
      text,
      confidence,
      language: 'en',
      words: alternative.words,
    };
  }
}
