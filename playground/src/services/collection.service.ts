import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './web3.service';
import { SupabaseService } from './supabase.service';

import { Transaction, hexToString, zeroAddress } from 'viem';
import crypto from 'crypto';

import MissingPhunks from '../collections/missing-phunks_FINAL.json';
import EtherPhunksAttributes from '../_attributes.json';

import { CuratedItem, Ethscription, Event } from 'src/models/db';
import { writeFile } from 'fs/promises';

import sharp from 'sharp';

@Injectable()
export class CollectionService {

  constructor(
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {
    // this.indexCuratedCollection();
  }

  async indexCuratedCollection() {

    const curated = MissingPhunks;

    let count = 0;
    for (const item of curated) {

      const hashId = item.hashId.replace(/\s+/g, '');
      const tx = await this.web3Svc.getTransaction(hashId as `0x${string}`);
      const block = await this.web3Svc.getBlock(tx.blockNumber);
      const createdAt = new Date(Number(block.timestamp) * 1000);

      const utf8Input = hexToString(tx.input);

      const imageData = utf8Input.startsWith('data:image/svg+xml') ?
        decodeURIComponent(utf8Input.split(',')[1]) :
        utf8Input.split(',')[1];

      const sha = crypto.createHash('sha256').update(utf8Input).digest('hex');
      const image = utf8Input.startsWith('data:image/svg+xml') ?
        Buffer.from(imageData) :
        Buffer.from(imageData, 'base64');

      const png = await sharp(image)
        .png()
        .toBuffer();

      await this.sbSvc.uploadImage(
        png,
        sha,
      );

      await this.sbSvc.addCurated(
        tx,
        createdAt,
        {
          name: item.name,
          slug: 'missing-phunks',
          tokenId: Number(item.name.split('#')[1]),
          sha,
        }
      );

      await this.sbSvc.addEvent(
        tx,
        tx.from.toLowerCase(),
        tx.to.toLowerCase(),
        hashId,
        'created',
        createdAt,
        BigInt(0),
        Number(tx.transactionIndex),
      );

      count++;
      Logger.log(`Processed ${ count } of ${ curated.length }`, 'CollectionService');
      // break;
    }
  }

  async indexCollection() {
    // const collection = MissingPhunks;

    // const attributes: any = {};

    // for (const item of collection) {
    //   const hashId = item.hashId;

    //   const tx = await this.web3Svc.getTransaction(hashId as `0x${string}`);

    //   const image = hexToString(tx.input);
    //   const sha = crypto.createHash('sha256').update(image).digest('hex');

    //   attributes[sha] = item.attributes;

    //   const exists = await this.sbSvc.checkEthscriptionExistsBySha(sha);
    //   if (exists) {
    //     Logger.log('SHA Exists', `${ sha } -- ${ item.tokenId }`);
    //     continue;
    //   }

    //   const curatedItem: CuratedItem = {
    //     name: item.name,
    //     image,
    //     attributes: item.attributes,
    //     slug: item.slug,
    //     tokenId: item.tokenId,
    //     sha,
    //   };

    //   const event = await this.processCuratedCreationEvent(tx, new Date(), curatedItem);
    //   await this.sbSvc.addEvents([event]);
    // }

    // await writeFile(`./${collection[0].slug}_attributes.json`, JSON.stringify(attributes));
  }

  async generateTraitRarity(collection: any[]) {
    const traitRarity: any = {};
    for (const item of collection) {
      const attributes = item.attributes;
      for (const attr of attributes) {
        if (!traitRarity[attr.v]) traitRarity[attr.v] = 0;
        traitRarity[attr.v]++;
      }
    }
    await writeFile(`./${collection[0].slug}_rarity.json`, JSON.stringify(traitRarity));
  }

  async processCuratedCreationEvent(
    txn: Transaction,
    createdAt: Date,
    curatedItem: CuratedItem
  ): Promise<Event> {
    const { from, to, hash: hashId } = txn;

    await this.sbSvc.addCurated(txn, createdAt, curatedItem);
    await this.sbSvc.uploadFile(curatedItem);

    return {
      txId: txn.hash + txn.transactionIndex,
      type: 'created',
      hashId: hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: BigInt(0).toString(),
    };
  }

  async generateEtherPhunkAttributesFile() {
    const allPhunks = await this.sbSvc.getAllEthscriptions();
    const attributes: any = {};

    for (const phunk of allPhunks) {
      const tokenId = phunk.tokenId;
      const hashId = phunk.hashId;
      const sha = phunk.sha;
      attributes[sha] = EtherPhunksAttributes[tokenId];

      console.log(tokenId, hashId, sha);
    }

    await writeFile(`./ethereum-phunks_attributes.json`, JSON.stringify(attributes));
    process.exit(0);
  }
}
