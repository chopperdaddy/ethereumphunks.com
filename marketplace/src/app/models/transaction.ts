import { Phunk } from './graph';

export type TxType = 'sendToEscrow' | 'phunkNoLongerForSale' | 'offerPhunkForSale' | 'withdrawBidForPhunk' | 'acceptBidForPhunk' | 'buyPhunk' | 'enterBidForPhunk' | 'submitTransfer' | 'withdrawPhunk';

export type ModalType = 'transaction' | 'complete' | 'sell' | 'bid' | 'transfer' | 'acceptBid' | 'error' | null;

export interface TX {
  type: TxType;
  phunk: Phunk;

  value?: number | null;
  toAddress?: string | null;

  parent?: ModalType;
}

export interface ModalState {
  active: boolean;
  type: ModalType;
  hash?: string;
  title?: string;
  message?: string;
  parent?: ModalType;
  children?: ModalState[] | null;
}
