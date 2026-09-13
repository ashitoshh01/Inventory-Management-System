-- AlterTable
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_quantity_nonnegative" CHECK ("quantity" >= 0);
