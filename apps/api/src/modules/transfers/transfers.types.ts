import { StockTransferStatus } from '@repo/types';

export interface ValidatedTransferLine {
  productId: string;
  quantity: string;
  notes?: string | null;
}

export interface ValidatedCreateTransferInput {
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  notes?: string | null;
  lines: ValidatedTransferLine[];
  idempotencyPayloadHash?: string;
}

export interface ValidatedUpdateTransferInput {
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  notes?: string | null;
  lines?: ValidatedTransferLine[];
}

export interface TransferShipResult {
  transferId: string;
  status: StockTransferStatus;
  shippedAt: string;
  isIdempotentReplay: boolean;
}

export interface TransferReceiveResult {
  transferId: string;
  status: StockTransferStatus;
  receivedAt: string;
  isIdempotentReplay: boolean;
}
