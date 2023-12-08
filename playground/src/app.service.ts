import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';

import dotenv from 'dotenv';
import { writeFile } from 'fs/promises';
import { zeroAddress } from 'viem';
dotenv.config();

@Injectable()
export class AppService {
  constructor(
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {
    this.whatever();
  }

  async whatever() {

    // const hashId = '0xb9e22115aa7236d14d049c205208cc1e320232af60f318d9945098c03bc14a5f'.toLowerCase();
    // const prevOwner = '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7'.toLowerCase();

    // const phunkListing = this.web3Svc.phunksOfferedForSale(hashId);
    // const phunkBid = this.web3Svc.phunkBids(hashId);
    // const inEscrow = this.web3Svc.userEthscriptionPossiblyStored(prevOwner.toLowerCase(), hashId.toLowerCase());

    // const dbBid = this.sbSvc.getBid(hashId);
    // const dbListing = this.sbSvc.getListing(hashId);

    // const [listing, bid, escrow, dBid, dListing] = await Promise.all([phunkListing, phunkBid, inEscrow, dbBid, dbListing]);

    // console.log({listing, bid, escrow, dBid, dListing});

    // return;

    const allPhunks = await this.sbSvc.getAllEthPhunks();

    console.log(allPhunks.length);
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

      // Logger.log(`Done with ${count}`, hashId);
      count++;
    }

    await writeFile('incorrect.json', JSON.stringify(incorrect));
    console.log('No issues found');
  }
}
