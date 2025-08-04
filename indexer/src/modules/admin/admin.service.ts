import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '@/config/config.service';

import { StorageService } from '@/modules/storage/storage.service';
import { Web3Service } from '@/modules/shared/services/web3.service';
import { DataService } from '@/modules/shared/services/data.service';

import { Collection } from '@/modules/storage/models/db';
import { CollectionAdminService } from '@/modules/collection-admin/collection-admin.service';

import { mkdir, readFile, writeFile } from 'fs/promises';
import { fromHex } from 'viem';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AdminService implements OnModuleInit {

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    private readonly dbSvc: StorageService,
    private readonly dataSvc: DataService,
    private readonly configSvc: AppConfigService,
    private readonly collectionAdminSvc: CollectionAdminService
  ) {}

  async onModuleInit() {
    // this.indexNewCollection('mfpurrs');
    // this.createAndUploadCollectionImages('mfpurrs');
  }

  //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>//
  // GENERATE A COLLECTION METADATA FILE //
  //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>//

  /**
   * Adds a collection to the database collection table
   * This is a requirement to display the collection on the marketplace
   * @param slug - The slug of the collection
   * @param singleName - The single name of the collection
   */
  async createCollectionInDB(slug: string, singleName: string) {
    const metadata = await this.collectionAdminSvc.getMetadata(slug);

    const collection = {
      slug,
      name: metadata.name,
      singleName,
      description: metadata.description,
      image: metadata.logo_image,
      posterHashId: null,
      supply: metadata.total_supply,
      website: metadata.website_url,
      twitter: metadata.twitter_url,
      discord: metadata.discord_url,
      defaultBackground: metadata.background_color,
      standalone: true,
      active: false,
    } as Collection;

    try {
      await this.dbSvc.createCollection(collection);
    } catch(error) {
      Logger.error('Error adding collection to db', error);
      throw new Error('Error adding collection to db');
    }
  }

  /**
   * Creates and uploads images for all Dystophunks
   * Processes each item's image data and triggers upload to storage
   * This is a requirement for displaying images on the marketplace
   * @param slug - The slug of the collection
   */
  async createAndUploadCollectionImages(slug: string) {
    const metadata = await this.collectionAdminSvc.getMetadata(slug);

    for (const item of metadata.collection_items) {
      const { input } = await this.web3SvcL1.getTransaction(item.id as `0x${string}`);
      const imageDataCleaned = fromHex(input, 'string');
      const sha256 = crypto.createHash('sha256').update(imageDataCleaned).digest('hex');
      const image = Buffer.from(imageDataCleaned.split(',')[1], 'base64');
      const extension = imageDataCleaned.split(',')[0].split('/')[1].split(';')[0];

      await this.dbSvc.uploadImage(image, sha256, extension, slug);
    }
  }

  /**
   * Indexes a new collection
   * @param slug - The slug of the collection
   */
  async indexNewCollection(slug: string) {
    let metadata: string;
    try {
      metadata = await readFile(`./metadata/${slug}.json`, 'utf8');
    } catch (error) {
      Logger.error(`The collection "${slug}" does not have a metadata file`);
      return;
    }

    const collection = JSON.parse(metadata);
    for (let i = 0; i < collection.collection_items.length; i++) {
      await this.reIndexEthscriptionItemAndTransfers(collection.collection_items[i].id);
      if (i > 1) break;
    }
  }

  /**
   * Re-indexes an ethscription item and its transfers
   * @param hashId - The hash ID of the ethscription item
   */
  async reIndexEthscriptionItemAndTransfers(hashId: string) {
    const ethscription = await this.dataSvc.getEthscriptionByHashId(hashId);
    const transfers = ethscription.ethscription_transfers;

    for (const transfer of transfers) {
      await fetch(`https://relay.ethereumphunks.com/admin/reindex-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.configSvc.api.privateKey
        },
        body: JSON.stringify({ hash: transfer.transaction_hash })
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Checks the consensus of an existing collection
   * @param slug - The slug of the collection
   */
  async checkCollectionConsensus(slug: string) {
    const ethscriptions = await this.dbSvc.fetchAllEthscriptions(slug);

    const noConsensus = [];
    const errors = [];

    for (let idx = 0; idx < ethscriptions.length; idx++) {
      const ethscription = ethscriptions[idx];
      const { hashId } = ethscription;

      try {
        const { creator, owner, prevOwner } = await this.dbSvc.checkEthscriptionExistsByHashId(hashId);

        const {
          creator: consensusCreator,
          current_owner: consensusOwner,
          previous_owner: consensusPrevOwner
        } = await this.dataSvc.getEthscriptionByHashId(hashId);

        if (
          consensusCreator !== creator ||
          consensusOwner !== owner ||
          consensusPrevOwner !== prevOwner
        ) {
          Logger.error('No consensus', hashId);
          noConsensus.push(hashId);
        }

        Logger.log(`Checked ${idx} ethscriptions`);
      } catch(error) {
        Logger.error('Error', error);
        errors.push(hashId);
      }
    }

    Logger.log(`No consensus for ${noConsensus.length} ethscriptions`);
    await mkdir('./consensus', { recursive: true });
    await writeFile(`./consensus/${slug}_no_consensus.json`, JSON.stringify(noConsensus));
    await writeFile(`./consensus/${slug}_errors.json`, JSON.stringify(errors));
  }
}
