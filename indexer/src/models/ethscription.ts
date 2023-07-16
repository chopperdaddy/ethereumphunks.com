export interface Ethscription {
  id: string;
  createdAt: Date;
  creator: `0x${string}`;
  owner: `0x${string}`;
  hash: `0x${string}`;
  data: string;
  blockNumber: number;
  hashedData: string;
  txIndex: number;
  blockHash: `0x${string}`;
}