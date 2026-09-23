export interface TranscribeResult {
  text: string;
  confidence: number;
  language?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface SpeechToTextProvider {
  transcribe(audio: Buffer, mimeType?: string): Promise<TranscribeResult>;
}
