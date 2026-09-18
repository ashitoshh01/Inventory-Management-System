import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@repo/database';
import type { LowStockCheckJobPayload } from '@repo/types';
import { QUEUE_LOW_STOCK, JOB_CHECK_LOW_STOCK } from '../queue/queue.constants';
import { WorkerCircuitBreaker } from './worker-backoff.helper';

const LOW_STOCK_THRESHOLD = 10;

@Processor(QUEUE_LOW_STOCK, {
  concurrency: 2, // Lightweight I/O bound queries; concurrency 2 handles bursts safely
  drainDelay: 10, // 10s idle block ceiling
  stalledInterval: 60000, // Check stalled jobs once per minute
  maxStalledCount: 2,
  lockDuration: 30000,
})
@Injectable()
export class LowStockProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(LowStockProcessor.name);
  private readonly circuitBreaker = new WorkerCircuitBreaker(LowStockProcessor.name, this.logger);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  onModuleDestroy(): void {
    this.circuitBreaker.cleanup();
  }

  @OnWorkerEvent('error')
  async onError(err: Error): Promise<void> {
    await this.circuitBreaker.handleError(this.worker, err);
  }

  async process(job: Job<LowStockCheckJobPayload>): Promise<{ success: boolean; action: string }> {
    this.circuitBreaker.reset();
    if (job.name !== JOB_CHECK_LOW_STOCK) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return { success: false, action: 'unknown_job' };
    }

    const { organizationId, productId, warehouseId } = job.data;
    this.logger.log(`Processing low-stock check for product ${productId} in warehouse ${warehouseId} (org: ${organizationId})`);

    // 1. Authoritative check from PostgreSQL
    const balance = await this.prisma.stockBalance.findUnique({
      where: {
        organizationId_productId_warehouseId: {
          organizationId,
          productId,
          warehouseId,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });

    if (!balance || balance.product.status !== 'ACTIVE') {
      this.logger.debug(`Balance or active product not found for product ${productId}`);
      return { success: true, action: 'skipped_inactive' };
    }

    const qty = balance.quantity.toNumber();

    // 2. Determine alert type
    let alertType: 'OUT_OF_STOCK' | 'LOW_STOCK' | null = null;
    if (qty <= 0) {
      alertType = 'OUT_OF_STOCK';
    } else if (qty <= LOW_STOCK_THRESHOLD) {
      alertType = 'LOW_STOCK';
    }

    // Normal stock: no alert needed
    if (!alertType) {
      this.logger.debug(`Stock level (${qty}) is above threshold (${LOW_STOCK_THRESHOLD}), no alert needed.`);
      return { success: true, action: 'stock_normal' };
    }

    // 3. Deduplication Check: Prevent spamming if an unread notification already exists
    const recentUnreadNotifications = await this.prisma.notification.findMany({
      where: {
        organizationId,
        type: alertType,
        isRead: false,
      },
      select: {
        id: true,
        metadata: true,
      },
      take: 50,
    });

    const isDuplicate = recentUnreadNotifications.some((n) => {
      const meta = n.metadata as Record<string, unknown> | null;
      return meta?.productId === productId && meta?.warehouseId === warehouseId;
    });

    if (isDuplicate) {
      this.logger.debug(
        `Duplicate alert suppressed: Unread ${alertType} notification already exists for product ${productId} at warehouse ${warehouseId}.`,
      );
      return { success: true, action: 'suppressed_duplicate' };
    }

    // 4. Create authoritative notification
    const isOut = alertType === 'OUT_OF_STOCK';
    const title = isOut
      ? `Out of Stock: ${balance.product.name}`
      : `Low Stock Alert: ${balance.product.name}`;

    const message = isOut
      ? `Product ${balance.product.name} (${balance.product.sku}) in ${balance.warehouse.name} is completely out of stock.`
      : `Product ${balance.product.name} (${balance.product.sku}) in ${balance.warehouse.name} is low on stock (${qty} units remaining, threshold ≤ ${LOW_STOCK_THRESHOLD}).`;

    await this.prisma.notification.create({
      data: {
        organizationId,
        type: alertType,
        title,
        message,
        metadata: {
          productId,
          productName: balance.product.name,
          productSku: balance.product.sku,
          warehouseId,
          warehouseName: balance.warehouse.name,
          quantity: balance.quantity.toString(),
          threshold: LOW_STOCK_THRESHOLD,
        },
      },
    });

    this.logger.log(`Created ${alertType} notification for product ${balance.product.sku} in ${balance.warehouse.code}`);
    return { success: true, action: `created_${alertType.toLowerCase()}` };
  }
}
