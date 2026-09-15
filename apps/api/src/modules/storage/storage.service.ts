import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface StorageUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  resourceType: string;
}

export interface StorageUploadOptions {
  folder?: string;
  filename?: string;
  resourceType?: 'image' | 'raw' | 'auto' | 'video';
  tags?: string[];
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeCloudinary();
  }

  private initializeCloudinary(): void {
    const cloudinaryUrl =
      this.configService.get<string>('CLOUDINARY_URL') || process.env.CLOUDINARY_URL;
    let cloudName =
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || process.env.CLOUDINARY_CLOUD_NAME;
    let apiKey =
      this.configService.get<string>('CLOUDINARY_API_KEY') || process.env.CLOUDINARY_API_KEY;
    let apiSecret =
      this.configService.get<string>('CLOUDINARY_API_SECRET') || process.env.CLOUDINARY_API_SECRET;

    if (cloudinaryUrl) {
      try {
        const parsed = new URL(cloudinaryUrl);
        apiKey = parsed.username || apiKey;
        apiSecret = parsed.password || apiSecret;
        cloudName = parsed.hostname || cloudName;
      } catch {
        // fallback to standard process.env.CLOUDINARY_URL handling
        process.env.CLOUDINARY_URL = cloudinaryUrl;
      }
    }

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log(`Cloudinary storage initialized for cloud: ${cloudName}`);
    } else {
      this.logger.warn('Cloudinary storage credentials not found; storage is in unconfigured state');
    }
  }

  /**
   * Check if Cloudinary is configured and reachable.
   */
  async ping(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }
    try {
      const result = await cloudinary.api.ping();
      return result?.status === 'ok';
    } catch (err) {
      this.logger.error('Cloudinary ping health check failed', err);
      return false;
    }
  }

  /**
   * Upload a Buffer to Cloudinary via stream.
   */
  async uploadBuffer(
    buffer: Buffer,
    options: StorageUploadOptions = {},
  ): Promise<StorageUploadResult> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary storage service is not configured with valid credentials.');
    }

    const { folder = 'inventory-assets', filename, resourceType = 'auto', tags = [] } = options;

    return new Promise((resolve, reject) => {
      const uploadOptions: Record<string, any> = {
        folder,
        resource_type: resourceType,
        tags,
      };
      if (filename) {
        uploadOptions.public_id = filename;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`);
            return reject(error || new Error('Upload returned empty response'));
          }

          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            resourceType: result.resource_type,
          });
        },
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Delete a resource from Cloudinary by public ID.
   */
  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'raw' | 'video' = 'image',
  ): Promise<{ result: string }> {
    if (!this.isConfigured) {
      throw new Error('Cloudinary storage service is not configured.');
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        publicId,
        { resource_type: resourceType },
        (error, result) => {
          if (error) {
            this.logger.error(`Failed to delete Cloudinary resource ${publicId}: ${error.message}`);
            return reject(error);
          }
          resolve(result);
        },
      );
    });
  }

  /**
   * Generate an optimized transformation URL for an image asset.
   */
  getUrl(publicId: string, transformationOptions: Record<string, any> = {}): string {
    return cloudinary.url(publicId, {
      secure: true,
      ...transformationOptions,
    });
  }
}
