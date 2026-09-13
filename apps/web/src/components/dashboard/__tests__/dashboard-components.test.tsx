import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { DashboardStatsCards } from '../dashboard-stats-cards';
import { SalesOverviewChart } from '../sales-overview-chart';
import { TopSellingProducts } from '../top-selling-products';
import type { DashboardStatsDto, SalesOverviewPointDto, TopSellingProductDto } from '@repo/types';

// Mock Recharts to avoid DOM canvas/SVG measurement issues in JSDOM
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    Line: () => <div data-testid="chart-line" />,
    XAxis: () => <div data-testid="chart-xaxis" />,
    YAxis: () => <div data-testid="chart-yaxis" />,
    CartesianGrid: () => <div data-testid="chart-grid" />,
    Tooltip: () => <div data-testid="chart-tooltip" />,
  };
});

const mockUseSalesOverview = vi.fn();
const mockUseTopSellingProducts = vi.fn();

vi.mock('../../../hooks/use-dashboard', () => ({
  useSalesOverview: () => mockUseSalesOverview(),
  useTopSellingProducts: () => mockUseTopSellingProducts(),
}));

describe('Dashboard Components — Real DB Backed & Non-Hallucinatory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DashboardStatsCards', () => {
    it('renders all 4 authoritative KPI cards with actual values', () => {
      const stats: DashboardStatsDto = {
        totalProducts: 42,
        totalStock: '850.0000',
        lowStockCount: 3,
        outOfStockCount: 1,
        totalInventoryValue: '125430.50',
        todaysSales: '4820.00',
        todaysOrdersCount: 5,
      };

      renderWithClient(<DashboardStatsCards stats={stats} isLoading={false} />);

      expect(screen.getByText('Total Products')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();

      expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
      expect(screen.getByText('$125,430.50')).toBeInTheDocument();

      expect(screen.getByText('Low Stock Items')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      expect(screen.getByText("Today's Sales")).toBeInTheDocument();
      expect(screen.getByText('$4,820.00')).toBeInTheDocument();
      expect(screen.getByText(/orders placed today/i)).toBeInTheDocument();
    });

    it('does NOT render any hardcoded fake percentage badges', () => {
      const stats: DashboardStatsDto = {
        totalProducts: 10,
        totalStock: '100.0000',
        lowStockCount: 0,
        outOfStockCount: 0,
        totalInventoryValue: '500.00',
        todaysSales: '0.00',
        todaysOrdersCount: 0,
      };

      const { container } = renderWithClient(<DashboardStatsCards stats={stats} isLoading={false} />);

      expect(container.textContent).not.toContain('+8.3%');
      expect(container.textContent).not.toContain('+12.5%');
      expect(container.textContent).not.toContain('-2.4%');
      expect(container.textContent).not.toContain('+5.6%');
    });

    it('renders skeleton pulses when isLoading is true', () => {
      const { container } = renderWithClient(<DashboardStatsCards stats={undefined} isLoading={true} />);
      const pulses = container.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBeGreaterThan(0);
    });
  });

  describe('SalesOverviewChart', () => {
    it('renders chart when authoritative points are provided', () => {
      mockUseSalesOverview.mockReturnValue({
        data: {
          data: [
            { day: 'Wed', thisPeriod: 150, lastPeriod: 100 },
            { day: 'Thu', thisPeriod: 300, lastPeriod: 200 },
          ],
        },
        isLoading: false,
      });

      renderWithClient(<SalesOverviewChart />);

      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders honest empty state when no sales points exist', () => {
      mockUseSalesOverview.mockReturnValue({
        data: {
          data: [],
        },
        isLoading: false,
      });

      renderWithClient(<SalesOverviewChart />);

      expect(screen.getByText('Sales Overview')).toBeInTheDocument();
      expect(screen.getByText('No Sales Data In This Period')).toBeInTheDocument();
    });
  });

  describe('TopSellingProducts', () => {
    it('renders velocity table with real sales lines', () => {
      mockUseTopSellingProducts.mockReturnValue({
        data: {
          data: [
            {
              id: 'p-1',
              name: 'Heavy Industrial Bearing',
              sku: 'HIB-001',
              soldQty: '150',
              revenue: '4500.00',
            },
          ],
        },
        isLoading: false,
      });

      renderWithClient(<TopSellingProducts />);

      expect(screen.getByText('Top Selling Products')).toBeInTheDocument();
      expect(screen.getByText('Heavy Industrial Bearing')).toBeInTheDocument();
      expect(screen.getByText('HIB-001')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('$4500.00')).toBeInTheDocument();
    });

    it('renders clean empty state when no products have been sold', () => {
      mockUseTopSellingProducts.mockReturnValue({
        data: {
          data: [],
        },
        isLoading: false,
      });

      renderWithClient(<TopSellingProducts />);

      expect(screen.getByText('Top Selling Products')).toBeInTheDocument();
      expect(screen.getByText('No Sales Data Available')).toBeInTheDocument();
    });
  });
});
