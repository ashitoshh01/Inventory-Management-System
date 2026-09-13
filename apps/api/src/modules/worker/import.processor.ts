import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { PrismaService, Prisma } from '@repo/database';
import { ImportJobPayload, ImportRowErrorDto } from '@repo/types';
import { QUEUE_IMPORT, JOB_PROCESS_IMPORT } from '../queue/queue.constants';
import { CsvParserUtil } from '../imports/csv-parser.util';
import { ImportsValidator } from '../imports/imports.validator';
import { StockMutationService } from '../stock/stock-mutation.service';
import { AuditService } from '../audit/audit.service';
import { ProductValidator } from '../products/products.validator';
import { WarehouseValidator } from '../warehouses/warehouses.validator';

@Processor(QUEUE_IMPORT)
@Injectable()
export class ImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMutationService: StockMutationService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<ImportJobPayload>): Promise<{ success: boolean; importId: string }> {
    if (job.name !== JOB_PROCESS_IMPORT) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return { success: false, importId: job.data.importId };
    }

    const { importId, organizationId, userId, type, filePath, fileName, options } = job.data;
    this.logger.log(
      `Processing async import ${importId} (${type}) for user ${userId} in org ${organizationId}`,
    );

    // 1. Verify ImportJob exists and belongs to organization
    const importRecord = await this.prisma.importJob.findFirst({
      where: { id: importId, organizationId },
    });

    if (!importRecord) {
      this.logger.error(`ImportJob ${importId} not found in database for org ${organizationId}`);
      return { success: false, importId };
    }

    if (importRecord.status === 'COMPLETED') {
      this.logger.log(`ImportJob ${importId} is already completed. Skipping.`);
      return { success: true, importId };
    }

    // Mark PROCESSING
    await this.prisma.importJob.update({
      where: { id: importId },
      data: { status: 'PROCESSING' },
    });

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Import file not found on server storage: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = CsvParserUtil.parse(content);

      const errors: ImportRowErrorDto[] = [];
      let successfulRows = 0;
      let failedRows = 0;

      const mode = options?.mode || 'CREATE';

      if (type === 'PRODUCT') {
        // Fetch existing categories in org
        const categories = await this.prisma.category.findMany({
          where: { organizationId },
          select: { id: true, name: true },
        });
        const catMapByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
        const catMapById = new Map(categories.map((c) => [c.id, c.id]));

        const duplicateSkuTracker = new Set<string>();

        for (const row of parsed.rows) {
          const rowErrors = ImportsValidator.validateProductRow(row.rowNumber, row.data);

          const rawSku = row.data['sku'];
          const normSku = rawSku ? ProductValidator.normalizeSku(rawSku) : '';

          if (normSku) {
            if (duplicateSkuTracker.has(normSku)) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'sku',
                value: rawSku,
                code: 'DUPLICATE_SKU_IN_FILE',
                message: `Duplicate SKU "${normSku}" appears multiple times in import file.`,
              });
            } else {
              duplicateSkuTracker.add(normSku);
            }
          }

          // Category resolution
          let resolvedCategoryId: string | undefined;
          const rawCat = row.data['category'];
          if (rawCat && rawCat.trim() !== '') {
            const trimmedCat = rawCat.trim();
            resolvedCategoryId =
              catMapByName.get(trimmedCat.toLowerCase()) || catMapById.get(trimmedCat);
            if (!resolvedCategoryId) {
              rowErrors.push({
                row: row.rowNumber,
                column: 'category',
                value: rawCat,
                code: 'CATEGORY_NOT_FOUND',
                message: `Category "${trimmedCat}" does not exist in this organization.`,
              });
            }
          } else {
            // Default to first active category if none specified, or require it
            const defaultCategory = categories[0];
            if (defaultCategory) {
              resolvedCategoryId = defaultCategory.id;
            } else {
              rowErrors.push({
                row: row.rowNumber,
                column: 'category',
                value: null,
                code: 'NO_CATEGORIES_IN_ORGANIZATION',
                message: 'No categories exist in organization. A category is required.',
              });
            }
          }

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            failedRows++;
            continue;
          }

          // Execute Product Persistence
          try {
            const name = ProductValidator.validateName(row.data['name']);
            const description = ProductValidator.validateDescription(row.data['description']);
            const unitOfMeasure = ProductValidator.validateUnitOfMeasure(
              row.data['unitofmeasure'],
            );
            const status = ProductValidator.validateStatus(row.data['status']);
            const unitCost =
              row.data['unitcost'] && row.data['unitcost'].trim() !== ''
                ? new Prisma.Decimal(row.data['unitcost'].trim())
                : null;
            const unitPrice =
              row.data['unitprice'] && row.data['unitprice'].trim() !== ''
                ? new Prisma.Decimal(row.data['unitprice'].trim())
                : null;

            const existingProduct = await this.prisma.product.findFirst({
              where: { organizationId, sku: normSku },
            });

            if (existingProduct) {
              if (mode === 'UPSERT') {
                await this.prisma.product.update({
                  where: { id: existingProduct.id },
                  data: {
                    name,
                    ...(description !== undefined ? { description } : {}),
                    ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
                    unitOfMeasure,
                    status,
                    ...(unitCost !== null ? { unitCost } : {}),
                    ...(unitPrice !== null ? { unitPrice } : {}),
                  },
                });

                await this.auditService.logEvent({
                  organizationId,
                  actorUserId: userId,
                  action: 'product.updated_via_import',
                  entityType: 'Product',
                  entityId: existingProduct.id,
                  metadata: { importId, row: row.rowNumber, sku: normSku },
                });
                successfulRows++;
              } else {
                errors.push({
                  row: row.rowNumber,
                  column: 'sku',
                  value: rawSku,
                  code: 'DUPLICATE_SKU_IN_DATABASE',
                  message: `Product with SKU "${normSku}" already exists in database.`,
                });
                failedRows++;
              }
            } else {
              const created = await this.prisma.product.create({
                data: {
                  organizationId,
                  categoryId: resolvedCategoryId!,
                  name,
                  sku: normSku,
                  description,
                  unitOfMeasure,
                  status,
                  unitCost,
                  unitPrice,
                },
              });

              await this.auditService.logEvent({
                organizationId,
                actorUserId: userId,
                action: 'product.created_via_import',
                entityType: 'Product',
                entityId: created.id,
                metadata: { importId, row: row.rowNumber, sku: normSku },
              });
              successfulRows++;
            }
          } catch (rowErr: unknown) {
            errors.push({
              row: row.rowNumber,
              column: 'sku',
              value: rawSku,
              code: 'PRODUCT_MUTATION_FAILED',
              message: (rowErr as Error).message,
            });
            failedRows++;
          }
        }
      } else {
        // STOCK IMPORT
        // Cache products and warehouses
        const products = await this.prisma.product.findMany({
          where: { organizationId },
          select: { id: true, sku: true },
        });
        const productSkuMap = new Map(products.map((p) => [p.sku, p.id]));

        const warehouses = await this.prisma.warehouse.findMany({
          where: { organizationId },
          select: { id: true, code: true },
        });
        const warehouseCodeMap = new Map(warehouses.map((w) => [w.code, w.id]));

        for (const row of parsed.rows) {
          const rowErrors = ImportsValidator.validateStockRow(row.rowNumber, row.data);

          const rawSku = row.data['sku'];
          const normSku = rawSku ? ProductValidator.normalizeSku(rawSku) : '';
          const productId = normSku ? productSkuMap.get(normSku) : undefined;
          if (!productId) {
            rowErrors.push({
              row: row.rowNumber,
              column: 'sku',
              value: rawSku,
              code: 'PRODUCT_NOT_FOUND',
              message: `Product with SKU "${normSku}" does not exist in this organization.`,
            });
          }

          const rawWh = row.data['warehousecode'];
          const normWh = rawWh ? WarehouseValidator.normalizeCode(rawWh) : '';
          const warehouseId = normWh ? warehouseCodeMap.get(normWh) : undefined;
          if (!warehouseId) {
            rowErrors.push({
              row: row.rowNumber,
              column: 'warehouseCode',
              value: rawWh,
              code: 'WAREHOUSE_NOT_FOUND',
              message: `Warehouse with code "${normWh}" does not exist in this organization.`,
            });
          }

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            failedRows++;
            continue;
          }

          // Authoritative mutation via StockMutationService
          const mutationType = (row.data['type'] || 'ADJUSTMENT').trim().toUpperCase() as any;
          const quantityDelta = (row.data['quantitydelta'] || '').trim();
          const idempotencyKey = `import:${importId}:row:${row.rowNumber}`;
          const reason = row.data['reason']?.trim() || 'Bulk stock import';

          try {
            await this.stockMutationService.mutateStock({
              organizationId,
              productId: productId!,
              warehouseId: warehouseId!,
              type: mutationType,
              quantityDelta,
              idempotencyKey,
              referenceType: 'IMPORT',
              referenceId: importId,
              metadata: {
                importId,
                fileName,
                rowNumber: row.rowNumber,
                reason,
              },
              actorUserId: userId,
            });

            successfulRows++;
          } catch (mutationErr: unknown) {
            errors.push({
              row: row.rowNumber,
              column: 'quantityDelta',
              value: quantityDelta,
              code: 'STOCK_MUTATION_FAILED',
              message: (mutationErr as Error).message,
            });
            failedRows++;
          }
        }
      }

      // Final status determination
      let finalStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' = 'COMPLETED';
      if (failedRows > 0 && successfulRows > 0) {
        finalStatus = 'PARTIALLY_COMPLETED';
      } else if (failedRows > 0 && successfulRows === 0) {
        finalStatus = 'FAILED';
      }

      // Update ImportJob record
      await this.prisma.importJob.update({
        where: { id: importId },
        data: {
          status: finalStatus,
          processedRows: parsed.totalRows,
          successfulRows,
          failedRows,
          errors: errors as any,
          completedAt: new Date(),
        },
      });

      // Notification
      const friendlyType = type === 'PRODUCT' ? 'Product' : 'Stock';
      const notificationType = successfulRows > 0 ? 'IMPORT_COMPLETED' : 'IMPORT_FAILED';

      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          type: notificationType,
          title: `${friendlyType} Import ${finalStatus.replace(/_/g, ' ')}`,
          message: `Import of ${fileName} completed: ${successfulRows} succeeded, ${failedRows} failed out of ${parsed.totalRows} rows.`,
          metadata: {
            importId,
            type,
            status: finalStatus,
            fileName,
            totalRows: parsed.totalRows,
            successfulRows,
            failedRows,
          },
        },
      });

      this.logger.log(
        `ImportJob ${importId} finished with status ${finalStatus} (${successfulRows} succeeded, ${failedRows} failed)`,
      );

      return { success: true, importId };
    } catch (error: unknown) {
      this.logger.error(
        `ImportJob ${importId} fatal error: ${(error as Error).message}`,
        (error as Error).stack,
      );

      await this.prisma.importJob.update({
        where: { id: importId },
        data: {
          status: 'FAILED',
          errors: [
            {
              row: 0,
              code: 'FATAL_IMPORT_ERROR',
              message: (error as Error).message,
            },
          ] as any,
          completedAt: new Date(),
        },
      });

      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          type: 'IMPORT_FAILED',
          title: `${type} Import Failed`,
          message: `Import job for ${fileName} failed: ${(error as Error).message}`,
          metadata: {
            importId,
            type,
            status: 'FAILED',
            fileName,
          },
        },
      });

      throw error;
    }
  }
}
