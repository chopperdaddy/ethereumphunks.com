import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from '../services/web3.service';
import { SupabaseService } from '../services/supabase.service';

import { esip1Abi, esip2Abi } from 'src/abi/EthscriptionsProtocol';

import { decodeEventLog } from 'viem';

import dotenv from 'dotenv';
import { TransferEthscriptionForPreviousOwnerSignature, TransferEthscriptionSignature } from 'src/constants/EthscriptionsProtocol';
dotenv.config();

@Injectable()
export class PlaygroundService {

  constructor(
    private readonly ethSvc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {
    this.fixTransfers();
  }

  async fixTransfers() {
    // const transfers = await this.sbSvc.getAllTransfers();
    // // console.log({transfers});

    // const wrong = [];

    // for (const transfer of transfers) {
    //   const hash = transfer.txHash;

    //   const re = await this.ethSvc.getTransactionReceipt(hash as `0x${string}`);

    //   for (let i = 0; i < re.logs.length; i++) {
    //     const log = re.logs[i];

    //     const isEsip1 = log.topics[0] === TransferEthscriptionSignature;
    //     const isEsip2 = log.topics[0] === TransferEthscriptionForPreviousOwnerSignature;

    //     if (isEsip1 || isEsip2) {
    //       console.log({log});

    //       let decoded: any;

    //       if (isEsip1) decoded = decodeEventLog({
    //         abi: esip1Abi,
    //         data: log.data,
    //         topics: log.topics,
    //       });

    //       if (isEsip2) decoded = decodeEventLog({
    //         abi: esip2Abi,
    //         data: log.data,
    //         topics: log.topics,
    //       });

    //       if (decoded) {
    //         const sender = log.address;
    //         const prevOwner = decoded.args['previousOwner'];
    //         const recipient = decoded.args['recipient'];
    //         const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

    //         if (sender.toLowerCase() !== transfer.from.toLowerCase()) {
    //           await this.sbSvc.updateEvent(transfer.id, { from: sender, to: recipient });
    //           Logger.log('Updated event', `Hash: ${hash} -- From: ${sender.toLowerCase()} -- To: ${recipient.toLowerCase()}`);
    //         }
    //       }
    //     }

    //   }
    // }

    // console.log(wrong.length);
  }

}
