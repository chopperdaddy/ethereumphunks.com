import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';

import { writeFile } from 'fs/promises';
import { zeroAddress } from 'viem';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

import curated from './collections/missing-phunks.json';

@Injectable()
export class AppService {
  constructor(
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {

    this.inscribeMissingPhunksGoerli().then(() => {
      Logger.log('Ethscription process copmplete');
    }).catch((error) => {
      Logger.error('Error', error);
    });
  }

  async generateCuratedCollectionShas() {
    const withShas = [];
    for (const item of curated) {
      const imageData = item.image;
      const sha = crypto.createHash('sha256').update(imageData).digest('hex');

      withShas.push({
        ...item,
        collectionSlug: 'missing-phunks',
        tokenId: Number(item.name.split(' ')[1].replace('#', '')),
        sha,
      });
    }

    Logger.log('Done', `${ withShas.length}`);
    writeFile('./missing-phunks.json', JSON.stringify(withShas));
  }

  async inscribeMissingPhunksGoerli() {

    const ethscribed = [];
    for (let i = 0; i < curated.length; i++) {
      const inscription = curated[i];

      const image = inscription.image;
      const sha = crypto.createHash('sha256').update(image).digest('hex');

      const exists = await this.sbSvc.checkEthscriptionkExistsBySha(sha);
      if (exists) {
        Logger.log('Already exists', sha);
        continue;
      }

      const addresses = ['0xf1Aa941d56041d47a9a18e99609A047707Fe96c7', '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca'];
      const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];

      const hash = await this.web3Svc.ethscribe(image, randomAddress);
      Logger.debug('Processing', hash);

      try {
        const receipt = await this.web3Svc.waitForTransactionReceipt(hash as `0x${string}`);
        Logger.debug('Complete', receipt);
      } catch (error) {
        Logger.error('Error', error);
      }

      ethscribed.push({
        ...inscription,
        hashId: hash,
        owner: randomAddress,
      });

      await writeFile('./ethscribed.json', JSON.stringify(ethscribed));
      Logger.log(`Done with ${inscription.name}`, hash);
    }

    await writeFile('./ethscribed.json', JSON.stringify(ethscribed));
  }

  async checkDataIntegrity() {
    const allPhunks = await this.sbSvc.getAllEthPhunks();
    Logger.log(allPhunks.length + ' phunks total');

    let count = 0;
    const incorrect: any = {};
    for (const phunk of allPhunks) {
      // console.log(phunk)

      const hashId = phunk.hashId.toLowerCase();
      const prevOwner = phunk.prevOwner?.toLowerCase() || zeroAddress;

      const phunkListing = this.web3Svc.phunksOfferedForSale(hashId);
      const phunkBid = this.web3Svc.phunkBids(hashId);
      const inEscrow = this.web3Svc.userEthscriptionPossiblyStored(prevOwner, hashId);

      const dbBid = this.sbSvc.getBid(hashId);
      const dbListing = this.sbSvc.getListing(hashId);

      const [listing, bid, escrow, dBid, dListing] = await Promise.all([
        phunkListing,
        phunkBid,
        inEscrow,
        dbBid,
        dbListing,
      ]);

      function createHash(h: string) {
        if (!incorrect[h]) incorrect[h] = {};
      }

      // remove listings that exist in the db but not on chain
      if (!listing[0] && dListing) {
        // this.sbSvc.removeListing(hashId);
        createHash(hashId);
        incorrect[hashId]['listing'] = true;
        Logger.debug('Incorrect Listing (shouldnt be listed in db)', hashId);
      }

      if (listing[0] && !dListing) {
        // this.sbSvc.addListing(hashId, listing[0]);
        createHash(hashId);
        incorrect[hashId]['listing'] = true;
        Logger.debug('Incorrect Listing (shoulod be listed in db)', hashId);
      }

      // remove bids that exist in the db but not on chain
      if (!bid[0] && dBid) {
        // this.sbSvc.removeBid(hashId);
        createHash(hashId);
        incorrect[hashId]['bid'] = true;
        Logger.debug('Incorrect Bid (shouldnt have bid in db)', hashId);
      }

      if (bid[0] && !dBid) {
        // this.sbSvc.addBid(hashId, bid[0]);
        createHash(hashId);
        incorrect[hashId]['bid'] = true;
        Logger.debug('Incorrect Bid (should have bid in db)', hashId);
      }

      if (!escrow && phunk.owner.toLowerCase() === (process.env.MARKET_ADDRESS).toLowerCase()) {
        // this.sbSvc.removeEscrow(hashId);
        createHash(hashId);
        incorrect[hashId]['escrow'] = true;
        Logger.debug('Incorrect Escrow (shouldnt have escrow in db)', hashId);
      }

      if (escrow && phunk.owner.toLowerCase() !== (process.env.MARKET_ADDRESS).toLowerCase()) {
        // this.sbSvc.addEscrow(hashId, escrow);
        createHash(hashId);
        incorrect[hashId]['escrow'] = true;
        Logger.debug('Incorrect Escrow (should have escrow in db)', hashId);
      }

      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`Done with ${count} -- ${hashId}\r`);

      count++;
    }

    await writeFile('incorrect.json', JSON.stringify(incorrect));
    Logger.log(Object.keys(incorrect).length + ' incorrect phunks');

    this.checkDataIntegrity();
  }
}
