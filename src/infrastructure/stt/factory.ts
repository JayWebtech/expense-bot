import { SpeechToTextProvider } from './index';
import { DeepgramProvider } from './deepgram.provider';
import { MockSpeechToTextProvider } from './mock.provider';
import { config } from '../../config';
import { logger } from '../../shared/logger';

let provider: SpeechToTextProvider | null = null;

export function getSttProvider(): SpeechToTextProvider {
  if (provider) return provider;

  if (config.STT_PROVIDER === 'deepgram') {
    if (!config.DEEPGRAM_API_KEY) {
      logger.warn('STT_PROVIDER=deepgram but DEEPGRAM_API_KEY is not set — falling back to mock');
      provider = new MockSpeechToTextProvider();
    } else {
      provider = new DeepgramProvider(config.DEEPGRAM_API_KEY);
      logger.info('Speech-to-text: Deepgram (nova-3)');
    }
  } else {
    provider = new MockSpeechToTextProvider();
    logger.info('Speech-to-text: mock provider');
  }

  return provider;
}
