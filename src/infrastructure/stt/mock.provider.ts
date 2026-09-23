import { SpeechToTextProvider, TranscribeResult } from './index';

/**
 * Returns a static placeholder — used in development when no Deepgram key is set.
 */
export class MockSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(_audio: Buffer): Promise<TranscribeResult> {
    return {
      text: '',
      confidence: 0,
      language: 'en',
    };
  }
}
