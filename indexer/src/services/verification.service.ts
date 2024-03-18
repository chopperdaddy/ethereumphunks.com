import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import dotenv from 'dotenv';
import { createWalletClient, hashMessage, http, recoverAddress } from 'viem';
import { SupabaseService } from './supabase.service';
import { sepolia } from 'viem/chains';
dotenv.config();

const prefix = process.env.CHAIN_ID === '1' ? '' : 'sepolia-';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

@Injectable()
export class VerificationService {

  chain: 'mainnet' | 'sepolia' = process.env.CHAIN_ID === '1' ? 'mainnet' : 'sepolia';
  rpcURL: string = this.chain === 'mainnet' ? process.env.RPC_URL_MAINNET : process.env.RPC_URL_SEPOLIA;

  constructor(
    private readonly sbSvc: SupabaseService
  ) {}

  async verifySignature(
    { hashId, sha, signature }: { hashId: string, sha: string, signature: `0x${string}` }
  ) {
    console.log({ hashId, sha, signature });
    const message = 'bridge-phunk';

    const messageHash = hashMessage(message);

    const signingAddress = await recoverAddress({
      hash: messageHash,
      signature
    });

    const address = signingAddress.toLowerCase();

    console.log({ signingAddress });

    const item = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);

    if (!item) throw new Error(`HashId doesn't exist`);
    if (item.owner !== address) throw new Error(`Signer doesn't match owner`);
    if (item.sha !== sha) throw new Error(`SHA doesn't match`);

    const hashedString = `${prefix}${hashId}${item.owner.slice(2)}${item.prevOwner.slice(2)}`;

    console.log({ hashedString });
    return {hashedString};
    // return await this.signMessage(hashedString);
  }

  async signMessage(data: any): Promise<any> {

    const domain = {
      name: 'Ethereum Phunks Market',
      version: '1',
      chainId: Number(process.env.CHAIN_ID),
      verifyingContract: '0x3dfbc8c62d3ce0059bdaf21787ec24d5d116fe1e' as `0x${string}`,
    };

    const types = {
      Message: [
        { name: 'data', type: 'string' },
        { name: 'type', type: 'string' }
      ],
    };

    // Define the message to sign
    const message = {
      data: data, // The data you want to sign
      type: 'HashIdOwnership', // You can customize this field as needed
    };

    const walletClient = createWalletClient({
      chain: sepolia,
      key: process.env.DATA_DEPLOYER_PK,
      account: process.env.DATA_DEPLOYER_ADDRESS as `0x${string}`,
      transport: http(this.rpcURL)
    });

    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      primaryType: 'Message',
      domain,
      types,
      message
    });

    return signature;
  }


}
