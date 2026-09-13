import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import StockMovementReportPage from '../stock-movement/page';
import InventoryValuationReportPage from '../inventory-valuation/page';
import ReconciliationReportPage from '../reconciliation/page';
import ProcurementReportPage from '../procurement/page';
import SalesReportPage from '../sales/page';
import { reportsApi } from '../../../lib/api/reports';

// Mock the API layer
vi.mock('../../../lib/api/reports', () => ({
  reportsApi: {
    getStockMovement: vi.fn(),
    getInventoryValuation: vi.fn(),
    getReconciliation: vi.fn(),
    getProcurement: vi.fn(),
    getSales: vi.fn(),
    downloadCsv: vi.fn(),
  },
}));

// Mock warehouse selector hook
vi.mock('../../../hooks/use-warehouses', () => ({
  useWarehouses: () => ({
    data: {
      data: [
        { id: 'wh-1', name: 'Central Warehouse', code: 'WH-CENTRAL' },
      ],
    },
    isLoading: false,
  }),
}));

describe('Reports Pages Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StockMovementReportPage', () => {
    it('renders movement records and triggers CSV download on export click', async () => {
      vi.mocked(reportsApi.getStockMovement).mockResolvedValue({
        data: {
          items: [
            {
              id: 'mov-1',
              productId: 'prod-1',
              productName: 'Bolt M8',
              productSku: 'BLT-008',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              warehouseCode: 'WH-CENTRAL',
              type: 'RECEIPT',
              quantityDelta: '50.0000',
              quantityBefore: '10.0000',
              quantityAfter: '60.0000',
              referenceType: 'PURCHASE_ORDER',
              referenceId: 'po-123',
              actorEmail: 'admin@acme.com',
              createdAt: '2026-09-10T10:00:00.000Z',
            },
          ],
          summary: {
            totalMovements: 1,
            totalIn: '50.0000',
            totalOut: '0.0000',
            netChange: '+50.0000',
          },
          total: 1,
          page: 1,
          limit: 15,
          totalPages: 1,
        },
      } as any);

      renderWithClient(<StockMovementReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Stock Movements Report')).toBeInTheDocument();
        expect(screen.getByText('Bolt M8')).toBeInTheDocument();
        expect(screen.getAllByText('+50.0000').length).toBeGreaterThan(0);
      });

      const exportBtn = screen.getByRole('button', { name: /Export to CSV/i });
      fireEvent.click(exportBtn);

      expect(reportsApi.downloadCsv).toHaveBeenCalledWith(
        'stock-movement',
        expect.objectContaining({
          type: undefined,
          warehouseId: undefined,
        }),
      );
    });
  });

  describe('InventoryValuationReportPage', () => {
    it('renders valuation summary and product items', async () => {
      vi.mocked(reportsApi.getInventoryValuation).mockResolvedValue({
        data: {
          items: [
            {
              productId: 'prod-1',
              productName: 'Titanium Rod',
              productSku: 'ROD-TI',
              categoryName: 'Raw Materials',
              unitOfMeasure: 'KG',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              warehouseCode: 'WH-CENTRAL',
              quantity: '100.0000',
              unitCost: '25.00',
              unitPrice: '40.00',
              totalCostValue: '2500.00',
              totalRetailValue: '4000.00',
              stockStatus: 'IN_STOCK',
            },
          ],
          summary: {
            totalItems: 1,
            totalQuantity: '100.0000',
            totalCostValue: '2500.00',
            totalRetailValue: '4000.00',
          },
          total: 1,
          page: 1,
          limit: 15,
          totalPages: 1,
        },
      } as any);

      renderWithClient(<InventoryValuationReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Valuation Report')).toBeInTheDocument();
        expect(screen.getByText('Titanium Rod')).toBeInTheDocument();
        expect(screen.getAllByText((content) => content.includes('2500.00')).length).toBeGreaterThan(0);
        expect(screen.getAllByText((content) => content.includes('4000.00')).length).toBeGreaterThan(0);
      });
    });
  });

  describe('ReconciliationReportPage', () => {
    it('renders match and discrepancy badges correctly', async () => {
      vi.mocked(reportsApi.getReconciliation).mockResolvedValue({
        data: {
          items: [
            {
              productId: 'prod-1',
              productName: 'Gearbox A',
              productSku: 'GB-01',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              warehouseCode: 'WH-CENTRAL',
              currentBalance: '10.0000',
              ledgerDeltaSum: '10.0000',
              discrepancy: '0.0000',
              status: 'MATCH',
              lastMovementAt: '2026-09-11T12:00:00.000Z',
              ledgerEntriesCount: 5,
            },
            {
              productId: 'prod-2',
              productName: 'Drill Bit',
              productSku: 'DB-02',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              warehouseCode: 'WH-CENTRAL',
              currentBalance: '15.0000',
              ledgerDeltaSum: '10.0000',
              discrepancy: '+5.0000',
              status: 'DISCREPANCY',
              lastMovementAt: null,
              ledgerEntriesCount: 2,
            },
          ],
          summary: {
            totalBuckets: 2,
            totalMatches: 1,
            totalDiscrepancies: 1,
          },
          total: 2,
          page: 1,
          limit: 15,
          totalPages: 1,
        },
      } as any);

      renderWithClient(<ReconciliationReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Stock Reconciliation Report')).toBeInTheDocument();
        expect(screen.getByText('Read-Only Audit')).toBeInTheDocument();
        expect(screen.getByText('MATCH')).toBeInTheDocument();
        expect(screen.getByText('DISCREPANCY')).toBeInTheDocument();
      });
    });
  });

  describe('ProcurementReportPage', () => {
    it('renders purchase orders and status', async () => {
      vi.mocked(reportsApi.getProcurement).mockResolvedValue({
        data: {
          items: [
            {
              purchaseOrderId: 'po-1',
              purchaseOrderNumber: 'PO-2026-0001',
              supplierName: 'Acme Steel Inc.',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              status: 'RECEIVED',
              orderDate: '2026-09-01T00:00:00.000Z',
              expectedDate: '2026-09-05T00:00:00.000Z',
              grandTotal: '5500.00',
              currency: 'USD',
              linesCount: 4,
            },
          ],
          summary: {
            totalOrders: 1,
            totalValue: '5500.00',
            receivedCount: 1,
            pendingCount: 0,
          },
          total: 1,
          page: 1,
          limit: 15,
          totalPages: 1,
        },
      } as any);

      renderWithClient(<ProcurementReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Procurement Report')).toBeInTheDocument();
        expect(screen.getByText('PO-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('Acme Steel Inc.')).toBeInTheDocument();
        expect(screen.getByText('$5,500.00')).toBeInTheDocument();
      });
    });
  });

  describe('SalesReportPage', () => {
    it('renders sales orders and outbound revenue cards', async () => {
      vi.mocked(reportsApi.getSales).mockResolvedValue({
        data: {
          items: [
            {
              salesOrderId: 'so-1',
              salesOrderNumber: 'SO-2026-0001',
              customerName: 'Mega Corp',
              warehouseId: 'wh-1',
              warehouseName: 'Central Warehouse',
              status: 'DELIVERED',
              orderDate: '2026-09-08T00:00:00.000Z',
              grandTotal: '12800.00',
              currency: 'USD',
              linesCount: 3,
            },
          ],
          summary: {
            totalOrders: 1,
            totalRevenue: '12800.00',
            fulfilledOrders: 1,
            pendingOrders: 0,
          },
          total: 1,
          page: 1,
          limit: 15,
          totalPages: 1,
        },
      } as any);

      renderWithClient(<SalesReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Sales & Outbound Report')).toBeInTheDocument();
        expect(screen.getByText('SO-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('Mega Corp')).toBeInTheDocument();
        expect(screen.getByText('$12,800.00')).toBeInTheDocument();
      });
    });
  });
});
