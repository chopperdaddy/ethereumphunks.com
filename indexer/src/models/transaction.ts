export interface Transaction {
  id: string;
  createdAt: Date;
  from: `0x${string}`;
  to: `0x${string}`;
  blockNumber: number;
  hash: `0x${string}`;
  data: string;
  txIndex: number;
  blockHash: `0x${string}`;
}