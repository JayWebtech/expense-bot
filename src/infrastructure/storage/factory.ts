import { StorageProvider } from './index';
import { CloudinaryProvider } from './cloudinary.provider';
import { config } from '../../config';
import { logger } from '../../shared/logger';

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;

  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    );
  }

  provider = new CloudinaryProvider();
  logger.info('Storage provider: Cloudinary');
  return provider;
}
