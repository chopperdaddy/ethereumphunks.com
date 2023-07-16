export interface Transfer {
  id: string;
  createdAt: Date;
  from: `0x${string}`;
  to: `0x${string}`;
  transferHash: `0x${string}`;
  idHash: `0x${string}`;
  blockNumber: number;
  txIndex: number;
  blockHash: `0x${string}`;
}