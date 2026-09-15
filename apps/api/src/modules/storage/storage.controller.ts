import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService, StorageUploadResult } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { Organization } from '@repo/database';

export interface UploadedMulterFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Health/Ping check for Cloudinary storage connectivity.
   */
  @Get('status')
  async getStatus(): Promise<{ provider: string; status: 'up' | 'down' }> {
    const isUp = await this.storageService.ping();
    return {
      provider: 'cloudinary',
      status: isUp ? 'up' : 'down',
    };
  }

  /**
   * Upload an asset (image, document, CSV) to Cloudinary.
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentOrganization() org: Organization,
    @UploadedFile() file?: UploadedMulterFile,
    @Query('folder') subfolder?: string,
  ): Promise<StorageUploadResult> {
    if (!file) {
      throw new BadRequestException('File is required for upload.');
    }

    const folderPath = subfolder
      ? `inventory/${org.slug || org.id}/${subfolder}`
      : `inventory/${org.slug || org.id}`;

    return this.storageService.uploadBuffer(file.buffer, {
      folder: folderPath,
      resourceType: 'auto',
      tags: [org.slug || org.id],
    });
  }
}
