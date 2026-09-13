import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseUUIDPipe,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { User, Organization } from '@repo/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { ImportsService } from './imports.service';
import { PreviewImportDto, CreateImportDto, QueryImportJobDto } from './dto/imports.dto';

export interface UploadedMulterFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('imports')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  private extractPermissions(req: any, user: any): string[] {
    if (req.activeMembership?.role?.permissions) {
      return req.activeMembership.role.permissions.map(
        (rp: any) => rp.permission?.action || rp.action || rp,
      );
    }
    return user?.permissions || [];
  }

  /**
   * Dry-run preview and schema validation (read-only, no mutations).
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: any,
    @Req() req: any,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() dto: PreviewImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Import file is required.');
    }

    // RBAC check based on type
    const permissions = this.extractPermissions(req, user);
    if (dto.type === 'PRODUCT' && !permissions.includes('product.create')) {
      throw new ForbiddenException('You lack permission "product.create" to import products.');
    }
    if (dto.type === 'STOCK' && !permissions.includes('stock.mutate')) {
      throw new ForbiddenException('You lack permission "stock.mutate" to import stock.');
    }

    return this.importsService.generatePreview(
      org.id,
      dto.type,
      {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        buffer: file.buffer,
      },
      dto.mode,
    );
  }

  /**
   * Submit and enqueue asynchronous import job.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createJob(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: any,
    @Req() req: any,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() dto: CreateImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Import file is required.');
    }

    // RBAC check based on type
    const permissions = this.extractPermissions(req, user);
    if (dto.type === 'PRODUCT' && !permissions.includes('product.create')) {
      throw new ForbiddenException('You lack permission "product.create" to import products.');
    }
    if (dto.type === 'STOCK' && !permissions.includes('stock.mutate')) {
      throw new ForbiddenException('You lack permission "stock.mutate" to import stock.');
    }

    return this.importsService.createImportJob(
      org.id,
      user.id,
      {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        buffer: file.buffer,
      },
      dto,
    );
  }

  /**
   * List paginated import jobs for organization.
   */
  @Get()
  async listJobs(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryImportJobDto,
  ) {
    return this.importsService.listImportJobs(org.id, query);
  }

  /**
   * Get detail and live progress of an import job.
   */
  @Get(':id')
  async getJob(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
  ) {
    return this.importsService.getImportJob(org.id, id);
  }

  /**
   * Download CSV of failed rows with error descriptions.
   */
  @Get(':id/errors')
  async downloadErrors(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @Res() res: Response,
  ) {
    const { csvString, filename } = await this.importsService.generateErrorCsv(org.id, id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (typeof res.send === 'function') {
      res.send(csvString);
    } else {
      res.write(csvString);
      res.end();
    }
  }
}
