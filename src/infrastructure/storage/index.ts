export interface UploadOptions {
  folder?: string;
  filename?: string;
  resourceType?: 'raw' | 'image' | 'video' | 'auto';
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  bytes: number;
  format: string;
}

export interface StorageProvider {
  upload(buffer: Buffer, options?: UploadOptions): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
  getSignedUrl(publicId: string, expiresInSeconds?: number): Promise<string>;
}
