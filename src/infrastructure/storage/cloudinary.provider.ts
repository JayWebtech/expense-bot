import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { StorageProvider, UploadOptions, UploadResult } from './index';
import { ExportError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { config } from '../../config';

export class CloudinaryProvider implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async upload(buffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
    const folder = options.folder
      ? `${config.CLOUDINARY_FOLDER}/${options.folder}`
      : config.CLOUDINARY_FOLDER;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: options.filename,
          resource_type: options.resourceType ?? 'raw',
          use_filename: !!options.filename,
          unique_filename: !options.filename,
        },
        (error, response) => {
          if (error || !response) {
            reject(new ExportError(error?.message ?? 'Cloudinary upload failed'));
          } else {
            resolve(response);
          }
        },
      );
      stream.end(buffer);
    });

    logger.debug(
      { publicId: result.public_id, bytes: result.bytes },
      'File uploaded to Cloudinary',
    );

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      bytes: result.bytes,
      format: result.format,
    };
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    logger.debug({ publicId }, 'File deleted from Cloudinary');
  }

  async getSignedUrl(publicId: string, expiresInSeconds = 3600): Promise<string> {
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      secure: true,
    });
  }
}
