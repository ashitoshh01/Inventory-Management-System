import { Injectable, Optional, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '@repo/database';
import {
  ImportJobType,
  ImportJobDto,
  ImportPreviewDto,
  ImportPreviewRowDto,
  ImportRowErrorDto,
  PaginatedResponse,
} from '@repo/types';
import { IMPORTS_STORAGE_DIR } from './imports.constants';
import { CsvParserUtil } from './csv-parser.util';
import { ImportsValidator } from './imports.validator';
import { ImportJobNotFoundException, ImportEmptyFileException } from './imports.errors';
import { CreateImportDto, QueryImportJobDto } from './dto/imports.dto';
import { QueueService } from '../queue/queue.service';
import { ProductValidator } from '../products/products.validator';
import { WarehouseValidator } from '../warehouses/warehouses.validator';
import { createPaginatedResponse } from '../core/dto/pagination.dto';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queueService?: QueueService,
  ) {
    try {
      if (!fs.existsSync(IMPORTS_STORAGE_DIR)) {
        fs.mkdirSync(IMPORTS_STORAGE_DIR, { recursive: true });
      }
    } catch (err) {
      this.logger.error(`Failed to initialize storage directory ${IMPORTS_STORAGE_DIR}`, err);
    }
  }

  /**
   * Strictly read-only dry-run preview and schema validation.
   */
  async generatePreview(
    organizationId: string,
    type: ImportJobType,
    file: { originalname: string; size: number; mimetype: string; buffer: Buffer },
    mode: 'CREATE' | 'UPSERT' = 'CREATE',
  ): Promise<ImportPreviewDto> {
    ImportsValidator.validateUploadedFile(file);

    const content = file.buffer.toString('utf8');
    const parsed = CsvParserUtil.parse(content);

    if (parsed.totalRows === 0) {
      throw new ImportEmptyFileException('Uploaded file contains no data rows.');
    }

    ImportsValidator.validateHeaders(type, parsed.normalizedHeaders, parsed.headers);

    const allErrors: ImportRowErrorDto[] = [];
    const previewRows: ImportPreviewRowDto[] = [];
    let validCount = 0;
    let invalidCount = 0;

    if (type === 'PRODUCT') {
      // 1. Gather all SKUs and Categories referenced in file
      const seenSkusInFile = new Map<string, number>(); // sku -> first row
      const referencedCategoryNames = new Set<string>();

      for (const row of parsed.rows) {
        const rawSku = row.data['sku'];
        if (rawSku && rawSku.trim() !== '') {
          try {
            const normSku = ProductValidator.normalizeSku(rawSku);
            if (!seenSkusInFile.has(normSku)) {
              seenSkusInFile.set(normSku, row.rowNumber);
            }
          } catch {
            // caught in row validator
          }
        }
        const rawCat = row.data['category'];
        if (rawCat && rawCat.trim() !== '') {
          referencedCategoryNames.add(rawCat.trim());
        }
      }

      // 2. Fetch existing products for SKU collision checking
      const existingProducts = await this.prisma.product.findMany({
        where: {
          organizationId,
          sku: { in: Array.from(seenSkusInFile.keys()) },
        },
        select: { sku: true },
      });
      const existingSkuSet = new Set(existingProducts.map((p) => p.sku));

      // 3. Fetch existing categories in organization
      const existingCategories = await this.prisma.category.findMany({
        where: {
          organizationId,
        },
        select: { id: true, name: true },
      });
      const catMapByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));
      const catMapById = new Map(existingCategories.map((c) => [c.id, c.id]));

      // 4. Validate each row
      const duplicateFileSkuTracker = new Set<string>();

      for (const row of parsed.rows) {
        const rowErrors = ImportsValidator.validateProductRow(row.rowNumber, row.data);

        // Check duplicate within file
        const rawSku = row.data['sku'];
        if (rawSku && rawSku.trim() !== '') {
          try {
            const normSku = ProductValidator.normalizeSku(rawSku);
            if (duplicateFileSkuTracker.has(normSku)) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'sku',
                value: rawSku,
                code: 'DUPLICATE_SKU_IN_FILE',
                message: `Duplicate SKU "${normSku}" appears multiple times in uploaded file.`,
              });
            } else {
              duplicateFileSkuTracker.add(normSku);
            }

            // Check duplicate in DB if mode is CREATE
            if (mode === 'CREATE' && existingSkuSet.has(normSku)) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'sku',
                value: rawSku,
                code: 'DUPLICATE_SKU_IN_DATABASE',
                message: `Product with SKU "${normSku}" already exists in database.`,
              });
            }
          } catch {
            // Already caught
          }
        }

        // Check category resolution
        const rawCat = row.data['category'];
        if (rawCat && rawCat.trim() !== '') {
          const trimmedCat = rawCat.trim();
          const foundId = catMapByName.get(trimmedCat.toLowerCase()) || catMapById.get(trimmedCat);
          if (!foundId) {
            rowErrors.push({
              row: row.rowNumber,
              column: 'category',
              value: rawCat,
              code: 'CATEGORY_NOT_FOUND',
              message: `Category "${trimmedCat}" does not exist in this organization.`,
            });
          }
        }

        const isValid = rowErrors.length === 0;
        if (isValid) {
          validCount++;
        } else {
          invalidCount++;
          allErrors.push(...rowErrors);
        }

        if (previewRows.length < 50) {
          previewRows.push({
            rowNumber: row.rowNumber,
            data: row.data,
            isValid,
            errors: rowErrors,
          });
        }
      }
    } else {
      // STOCK IMPORT PREVIEW
      // 1. Gather all SKUs and Warehouse codes referenced in file
      const referencedSkus = new Set<string>();
      const referencedWhCodes = new Set<string>();

      for (const row of parsed.rows) {
        const rawSku = row.data['sku'];
        if (rawSku && rawSku.trim() !== '') {
          try {
            referencedSkus.add(ProductValidator.normalizeSku(rawSku));
          } catch {
            // caught in row validator
          }
        }
        const rawWh = row.data['warehousecode'];
        if (rawWh && rawWh.trim() !== '') {
          try {
            referencedWhCodes.add(WarehouseValidator.normalizeCode(rawWh));
          } catch {
            // caught in row validator
          }
        }
      }

      // 2. Fetch existing products and warehouses in organization
      const [existingProducts, existingWarehouses] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            organizationId,
            sku: { in: Array.from(referencedSkus) },
          },
          select: { id: true, sku: true },
        }),
        this.prisma.warehouse.findMany({
          where: {
            organizationId,
            code: { in: Array.from(referencedWhCodes) },
          },
          select: { id: true, code: true },
        }),
      ]);

      const productSkuMap = new Map(existingProducts.map((p) => [p.sku, p.id]));
      const warehouseCodeMap = new Map(existingWarehouses.map((w) => [w.code, w.id]));

      for (const row of parsed.rows) {
        const rowErrors = ImportsValidator.validateStockRow(row.rowNumber, row.data);

        // Reference checks
        const rawSku = row.data['sku'];
        if (rawSku && rawSku.trim() !== '') {
          try {
            const normSku = ProductValidator.normalizeSku(rawSku);
            if (!productSkuMap.has(normSku)) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'sku',
                value: rawSku,
                code: 'PRODUCT_NOT_FOUND',
                message: `Product with SKU "${normSku}" does not exist in this organization.`,
              });
            }
          } catch {
            // caught
          }
        }

        const rawWh = row.data['warehousecode'];
        if (rawWh && rawWh.trim() !== '') {
          try {
            const normWh = WarehouseValidator.normalizeCode(rawWh);
            if (!warehouseCodeMap.has(normWh)) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'warehouseCode',
                value: rawWh,
                code: 'WAREHOUSE_NOT_FOUND',
                message: `Warehouse with code "${normWh}" does not exist in this organization.`,
              });
            }
          } catch {
            // caught
          }
        }

        const isValid = rowErrors.length === 0;
        if (isValid) {
          validCount++;
        } else {
          invalidCount++;
          allErrors.push(...rowErrors);
        }

        if (previewRows.length < 50) {
          previewRows.push({
            rowNumber: row.rowNumber,
            data: row.data,
            isValid,
            errors: rowErrors,
          });
        }
      }
    }

    return {
      type,
      fileName: file.originalname,
      fileSize: file.size,
      totalRows: parsed.totalRows,
      validRows: validCount,
      invalidRows: invalidCount,
      errors: allErrors,
      previewRows,
      headers: parsed.headers,
    };
  }

  /**
   * Creates an ImportJob record, saves the file to secure storage, and dispatches to queue.
   */
  async createImportJob(
    organizationId: string,
    userId: string,
    file: { originalname: string; size: number; mimetype: string; buffer: Buffer },
    dto: CreateImportDto,
  ): Promise<ImportJobDto> {
    ImportsValidator.validateUploadedFile(file);

    const content = file.buffer.toString('utf8');
    const parsed = CsvParserUtil.parse(content);

    if (parsed.totalRows === 0) {
      throw new ImportEmptyFileException('Uploaded file contains no data rows.');
    }

    ImportsValidator.validateHeaders(dto.type, parsed.normalizedHeaders, parsed.headers);

    // 1. Create DB record in PENDING state
    const jobRecord = await this.prisma.importJob.create({
      data: {
        organizationId,
        userId,
        type: dto.type,
        status: 'PENDING',
        fileName: file.originalname,
        fileSize: file.size,
        totalRows: parsed.totalRows,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        metadata: {
          mode: dto.mode || 'CREATE',
          dryRun: dto.dryRun || false,
        },
      },
    });

    // 2. Write file to storage
    if (!fs.existsSync(IMPORTS_STORAGE_DIR)) {
      fs.mkdirSync(IMPORTS_STORAGE_DIR, { recursive: true });
    }
    const storageFileName = `import-${jobRecord.id}.csv`;
    const storageFilePath = path.join(IMPORTS_STORAGE_DIR, storageFileName);
    fs.writeFileSync(storageFilePath, file.buffer);

    // 3. Enqueue to BullMQ worker if available
    if (this.queueService) {
      await this.queueService.enqueueImport({
        importId: jobRecord.id,
        organizationId,
        userId,
        type: dto.type,
        filePath: storageFilePath,
        fileName: file.originalname,
        options: {
          mode: dto.mode || 'CREATE',
          dryRun: dto.dryRun || false,
        },
      });
    } else {
      this.logger.warn(`QueueService not injected; import job ${jobRecord.id} remains PENDING`);
    }

    return this.mapToDto(jobRecord);
  }

  /**
   * Retrieves single import job with tenant scoping.
   */
  async getImportJob(organizationId: string, id: string): Promise<ImportJobDto> {
    const job = await this.prisma.importJob.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!job) {
      throw new ImportJobNotFoundException(`Import job "${id}" was not found.`);
    }

    return this.mapToDto(job);
  }

  /**
   * Lists paginated import jobs for organization.
   */
  async listImportJobs(
    organizationId: string,
    query: QueryImportJobDto,
  ): Promise<PaginatedResponse<ImportJobDto>> {
    const where = {
      organizationId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, items] = await Promise.all([
      this.prisma.importJob.count({ where }),
      this.prisma.importJob.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: query.sortOrder || 'desc',
        },
      }),
    ]);

    return createPaginatedResponse(
      items.map((j) => this.mapToDto(j)),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * Generates downloadable CSV of errors for an import job.
   */
  async generateErrorCsv(
    organizationId: string,
    id: string,
  ): Promise<{ csvString: string; filename: string }> {
    const job = await this.getImportJob(organizationId, id);

    const errors: ImportRowErrorDto[] = (job.errors as ImportRowErrorDto[]) || [];
    const lines: string[] = [];

    // Header
    lines.push('Row Number,Column,Submitted Value,Error Code,Error Message');

    for (const err of errors) {
      const row = [
        err.row,
        err.column || '',
        err.value ?? '',
        err.code,
        err.message,
      ].map((cell) => CsvParserUtil.escapeCsvCell(cell));

      lines.push(row.join(','));
    }

    const filename = `import-errors-${job.id}.csv`;
    return {
      csvString: lines.join('\n'),
      filename,
    };
  }

  private mapToDto(job: any): ImportJobDto {
    return {
      id: job.id,
      organizationId: job.organizationId,
      userId: job.userId,
      type: job.type,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.fileSize,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successfulRows: job.successfulRows,
      failedRows: job.failedRows,
      errors: (job.errors as ImportRowErrorDto[]) || null,
      metadata: (job.metadata as Record<string, unknown>) || null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
