import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './services/web3.service';
import { SupabaseService } from './services/supabase.service';
import { DataService } from './services/data.service';
import { UtilityService } from './utils/utility.service';

import { readFile, writeFile } from 'fs/promises';

import missingPhunks from './collections/missing-phunks_FINAL.json';

import EtherPhunksAttributes from './attributes/ethereum-phunks_attributes.json';
import MissingPhunksAttributes from './attributes/missing-phunks_attributes.json';
// import nogood from '../nogood.json';

import sharp from 'sharp';


import crypto from 'crypto';
import { formatEther, hexToString, toHex } from 'viem';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class AppService {
  constructor(
    private readonly web3Svc: Web3Service,
    private readonly sbSvc: SupabaseService,
    private readonly dataSvc: DataService,
    private readonly utilSvc: UtilityService,
  ) {
    // this.getEventHashesForHashIds();
    // this.deleteEventsForHashIds();
    // this.addAttributes();
    // this.start();

    // this.rescribeMissingPhunks();
    // this.getActiveWithdrawals();

    // this.rescribeEtherPhunksSepolia();
    // this.migratePoints();
  }

  async rescribeEtherPhunksSepolia() {

    const etherPhunksGoerli = await this.sbSvc.getAllEthscriptions();
    console.log({ etherPhunksGoerli });

    for (const etherPhunk of etherPhunksGoerli) {

      const { owner, prevOwner, hashId, data, tokenId } = etherPhunk;

      // if (tokenId < 3749) continue;

      // console.log({ owner, prevOwner, hashId, data })

      try {
        const oldMarkets = ['0xcd8ec38a9ff21cf3f2c21d06fe7904de3c3a52a3', '0x53A699992a217C6a802A8986634064De2E213E1C'].map(m => m.toLowerCase());

        const sendTo = oldMarkets.includes(owner.toLowerCase()) ? prevOwner : owner;

        const rescribeTx = await this.web3Svc.ethscribe(data, sendTo);
        Logger.debug(`Rescribing EtherPhunk #${tokenId} to ${sendTo} -- ${rescribeTx}`);

        await this.utilSvc.delay(2000);

        // const receipt = await this.web3Svc.waitForTransactionReceipt(rescribeTx as `0x${string}`);
        // Logger.log(`EtherPhunk #${tokenId} Complete -- ${receipt.transactionHash}`);
      } catch (error) {
        Logger.error(error);
      }
    }

  }

  // async getActiveWithdrawals() {

  //   // const users = await this.sbSvc.getUsers();

  //   // const allWithdrawals = [];
  //   // let total = 0;
  //   // for (let i = 0; i < users.length; i++) {
  //   //   const user = users[i];
  //   //   const pendingWithdrawals = await this.web3Svc.pendingWithdrawals(user.address);
  //   //   if (pendingWithdrawals > 0) {
  //   //     const ethAmount = Number(formatEther(pendingWithdrawals));
  //   //     allWithdrawals.push({
  //   //       address: user.address,
  //   //       ethAmount
  //   //     });

  //   //     // if (ethAmount < 2) {
  //   //       total += ethAmount;
  //   //       console.log(`${i} -- ${user.address} -- ${formatEther(pendingWithdrawals)}`);
  //   //     // }
  //   //   }
  //   // }

  //   // console.log('Total:', total + .4);
  //   // await writeFile('./pending-withdrawals.json', JSON.stringify(allWithdrawals));

  //   const withdrawals = JSON.parse(await readFile('./pending-withdrawals.json', 'utf-8'));

  //   let total = 0;
  //   for (let i = 0; i < withdrawals.length; i++) {
  //     const withdrawal = withdrawals[i];
  //     console.log(withdrawal)
  //     total += withdrawal.ethAmount;
  //   }
  //   console.log('Total:', total);

  // }

  // async rescribePhunkSVGs() {

  //   const stolen = [
  //     // {
  //     //   hashId: '0x133fd2348449915550ba41ce9b5433c335a163b5bd428c76603daa58c9aa3909',
  //     //   owner: '0x64698f3223c010ccf1a28486969a669f3c4ed748'
  //     // },
  //     // {
  //     //   hashId: '0x1a3d57826770324a0af85a17196944cea10af167bfbee9794fa573cb96798992',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x364482f3ed9e908a618ba43e610ce4af7a6cc7558705b64862ea5d9bd8902e92',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x43823e8f997a1f0d30c152a4462128abd028300bc0202ddc03054d09e6bc35ce',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x7b5b2e95e16df6b926e9fdc40d4943a9c3041491c039a37ee9486b8962c68718',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x7de44c2250502477dfa49ae7f745af22dd223598b42d826495254a69b64341ad',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x8163e793e65a7d73df7bb01b56b5ce0b80160510f0d22731a4b91cafc78b8c28',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0x8478305f394aafa8e766dec83a600af4e5c5aa9af9fb774a0266bb9dabc8d866',
  //     //   owner: '0x78d3aaf8e3cd4b350635c79b7021bd76144c582c'
  //     // },
  //     // {
  //     //   hashId: '0x9bce9210359a937c80891fc75f43b2805a1d4c37b1f55e907a3776c885babe57',
  //     //   owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     // },
  //     // {
  //     //   hashId: '0xb73019848d725c4502ed3b4f0d29f7481b54699409e5589dcda52d22829c8dee',
  //     //   owner: '0xf1aa941d56041d47a9a18e99609a047707fe96c7'
  //     // },
  //     // {
  //     //   hashId: '0xd4e813f31e1e2be2d2af77c7e3679f567881749b28f367adc885ead5dd4fef04',
  //     //   owner: '0xa2f52aff3b31f8decfe50404442d040e71920cb6'
  //     // },
  //     // ======================= MISSING PHUNKS ================================= //
  //   ];

  //   for (let i = 0; i < stolen.length; i++) {
  //     const { hashId, owner } = stolen[i];
  //     const svgV1 = await this.web3Svc.getTransaction(hashId as `0x${string}`);

  //     const svgString = hexToString(svgV1.input);
  //     const decoded = decodeURIComponent(svgString.split(',')[1]);

  //     const newSvgString = decoded.replace('<svg', `<svg data-etherphunk-version="2"`);
  //     const newEncoded = encodeURIComponent(newSvgString);
  //     const newSvg = `data:image/svg+xml,${newEncoded}`;
  //     const newTxData = toHex(newSvg);

  //     const { tokenId } = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);

  //     const oldSha = crypto.createHash('sha256').update(svgString).digest('hex');
  //     const newSha = crypto.createHash('sha256').update(newSvg).digest('hex');

  //     const { ethscription: newData } = await this.dataSvc.checkEthscriptionExistsBySha(newSha);

  //     console.log({
  //       tokenId,
  //       owner,
  //       oldHashId: hashId,
  //       newHashId: newData.transaction_hash,
  //       oldSha,
  //       newSha,
  //     });
  //   }
  // }

  // async rescribeMissingPhunks() {

  //   const extract = require('png-chunks-extract');
  //   const text = require('png-chunk-text');
  //   const encode = require('png-chunks-encode');

  //   const stolen = [
  //     {
  //       hashId: '0x0b0e3d2f95b56a78764f644fd0bb4514d61e2040c9e2258caa64268c77fd2dd2',
  //       owner: '0x436196ab0550e73aeedd1a494c2420daca7fe0ca'
  //     },
  //     {
  //       hashId: '0x0c71abcad8e04c5c4df30557ef25e18379d8954310df1828dca15cdb4ab4fdfd',
  //       owner: '0x6466c91c32a6ee95c7d0660659cdfbcd2eee475d'
  //     },
  //     {
  //       hashId: '0x0f5de6336c39d0ec8c706b338e8b1b2fded6d9507842182718b4c210a8d64bbe',
  //       owner: '0x436196ab0550e73aeedd1a494c2420daca7fe0ca'
  //     },
  //     {
  //       hashId: '0x297edcae73d940c31b890d6236c3d121436acc4adcc508adb0725504da2ba86f',
  //       owner: '0x436196ab0550e73aeedd1a494c2420daca7fe0ca'
  //     },
  //     {
  //       hashId: '0x3dc2de2b1b934a1116ecd463b32a7863c301fb1dee5eb9e56186bdd52ac65119',
  //       owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     },
  //     {
  //       hashId: '0x81549be9e250c8f25c84a593f7e2013ad341da0fa3898d6e5bc467979e6ea2ab',
  //       owner: '0x436196ab0550e73aeedd1a494c2420daca7fe0ca'
  //     },
  //     {
  //       hashId: '0xa4a55892ffb2068fb444e1ae253ca94a70ec098b7ed7ee4f5c0a80a0acc2a3f6',
  //       owner: '0xf1aa941d56041d47a9a18e99609a047707fe96c7'
  //     },
  //     {
  //       hashId: '0xb59684842ecfa61eb53b2ec2d717ae17d2937f2e4ad642e85c149a2d05838738',
  //       owner: '0x32f12843e7dba0e9452f5223713bb9a332313d2e'
  //     },
  //     {
  //       hashId: '0xc0a31c945c0ad124a1146aa0244a11705d58e3b7a8499503b65a8a709e333ebf',
  //       owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     },
  //     {
  //       hashId: '0xc7d96417f72ad209c1b55bf452694602c9a4e7cd7878a4fd936c9dc54dbd00c1',
  //       owner: '0xfe84e7c7cd5b01f270217cdd7f69927caf2d0e2f'
  //     },
  //   ];

  //   const newMissingPhunks = [];
  //   for (let i = 0; i < stolen.length; i++) {
  //     const { hashId, owner } = stolen[i];
  //     const svgV1 = await this.web3Svc.getTransaction(hashId as `0x${string}`);

  //     const inputData = hexToString(svgV1.input);
  //     const oldPng = inputData.split(',')[1];
  //     const oldPngBuffer = Buffer.from(oldPng, 'base64');

  //     const oldSha = crypto.createHash('sha256').update(oldPng).digest('hex');

  //     const chunks = extract(oldPngBuffer);
  //     const metadataChunk = text.encode('MissingPhunkVersion', '2');
  //     chunks.splice(-1, 0, metadataChunk);
  //     const newBuffer = Buffer.from(encode(chunks));

  //     const newBase64 = newBuffer.toString('base64');
  //     const newPng = 'data:image/png;base64,' + newBase64;
  //     const newSha = crypto.createHash('sha256').update(newPng).digest('hex');
  //     const newTxData = toHex(newPng);

  //     try {
  //       const { tokenId } = await this.sbSvc.checkEthscriptionExistsByHashId(hashId);
  //       const { ethscription: newData } = await this.dataSvc.checkEthscriptionExistsBySha(newSha);
  //       // console.log(newData);
  //       Logger.log(`${i} -- ${hashId} -- ${tokenId} -- ${newData.transaction_hash}`);

  //       newMissingPhunks.push({
  //         tokenId,
  //         owner,
  //         oldHashId: hashId,
  //         newHashId: newData.transaction_hash,
  //         oldSha,
  //         newSha,
  //         // newPng,
  //         // newTxData
  //       });
  //     } catch (error) {
  //       // console.log(error.message);
  //     }

  //     // await writeFile(`./missing-phunks-new/${newSha}.png`, newBuffer);
  //   }

  //   await writeFile('./new-missing-phunks.json', JSON.stringify(newMissingPhunks));

  // }

  // async addAttributes() {
  //   const collection = EtherPhunksAttributes;
  //   const all = [];

  //   for (const sha of Object.keys(collection)) {
  //     const attributes: {k: string, v: string}[] = collection[sha];

  //     const attrObj = {};
  //     for (let i = 0; i < attributes.length; i++) {

  //       const attr: {k: string, v: string} = {
  //         k: attributes[i].k.replace(/ /g, '-').toLowerCase(),
  //         v: attributes[i].v.replace(/ /g, '-').toLowerCase(),
  //       };

  //       if (attrObj[attr.k]) attrObj[attr.k] = [attrObj[attr.k], attr.v].flat();
  //       else attrObj[attr.k] = attr.v;
  //     }

  //     all.push({
  //       sha,
  //       attributes: attrObj,
  //     });
  //   }

  //   // writeFile('./MissingPhunksAttributes.json', JSON.stringify(all));
  //   try {
  //     await this.sbSvc.addAttributes(all);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }

  // async getBlocksFromEthscriptions() {
  //   const items = missingPhunks;

  //   const blocks = [];
  //   for (let i = 0; i < items.length; i++) {
  //     const item = items[i];
  //     const hashId = item.hashId.toLowerCase().replace(/\s+/g, '');
  //     const twin = await this.dataSvc.checkEthscriptionExistsByHashId(hashId);

  //     if (!twin) {
  //       Logger.error('No twin', hashId);
  //       continue;
  //     }

  //     const block = twin.block_number;
  //     blocks.push(block);

  //     if (twin.valid_transfers?.length) {
  //       for (const transfer of twin.valid_transfers) {
  //         blocks.push(transfer.block_number);
  //       }
  //     }

  //     Logger.log(`${i} -- ${hashId} -- ${block}`);
  //   }

  //   await writeFile('./missing-phunks_blocks.json', JSON.stringify(blocks));
  // }

  // async deleteEventsForHashIds() {
  //   const items = nogood;
  //   for (let i = 0; i < items.length; i++) {
  //     const item = items[i];
  //     await this.sbSvc.deleteEvent(item.toLowerCase().replace(/\s+/g, ''));
  //   }
  // }

  // async getEventHashesForHashIds() {
  //   const hashes = ["0xe9bcf751ddf2e88167a04980e2d7a17b2a0a347e2b5151d7fdd9c0e33feca1a7","0x402c79bad567515448bf265164d4fcda316fdd4666c305b14bb22bf4296eae68","0x08a91f74b3696c31aa1dc7001a34cae4083f90c5c10949be74fea989bd151573","0xd7d51032065771d1700e4c9730f27f53db4a2a326933f7862bbd5ed51bec4d32"];

  //   const events = [];
  //   for (let i = 0; i < hashes.length; i++) {
  //     const hashId = hashes[i];
  //     const twin = await this.dataSvc.checkEthscriptionExistsByHashId(hashId);

  //     if (twin.valid_transfers?.length) {
  //       for (const transfer of twin.valid_transfers) {
  //         events.push(transfer.transaction_hash?.toLowerCase());
  //       }
  //     }
  //   }
  //   await writeFile('./event-hashes.json', JSON.stringify(events));
  // }

  // async points(): Promise<void> {
  //   const users = await this.sbSvc.getUsers();
  //   for (const user of users) {
  //     const points = await this.web3Svc.getPoints(user.address);
  //     Logger.log(`${user.address} has ${points} points`);
  //     await this.sbSvc.updateUserPoints(user.address, points);
  //     Logger.log(`Updated ${user.address} with ${points} points`);
  //   }
  // }

  // async inscribeMissingPhunksGoerli() {

  //   const ethscribed = [];
  //   for (let i = 0; i < curated.length; i++) {
  //     const inscription = curated[i];

  //     const image = inscription.image;
  //     const sha = crypto.createHash('sha256').update(image).digest('hex');

  //     const exists = await this.sbSvc.checkEthscriptionkExistsBySha(sha);
  //     if (exists) {
  //       Logger.log('Already exists', sha);
  //       continue;
  //     }

  //     const addresses = ['0xf1Aa941d56041d47a9a18e99609A047707Fe96c7', '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca'];
  //     const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];

  //     const hash = await this.web3Svc.ethscribe(image, randomAddress);
  //     Logger.debug('Processing', hash);

  //     try {
  //       const receipt = await this.web3Svc.waitForTransactionReceipt(hash as `0x${string}`);
  //       Logger.debug('Complete', receipt);
  //     } catch (error) {
  //       Logger.error('Error', error);
  //     }

  //     ethscribed.push({
  //       ...inscription,
  //       hashId: hash,
  //       owner: randomAddress,
  //     });

  //     await writeFile('./ethscribed.json', JSON.stringify(ethscribed));
  //     Logger.log(`Done with ${inscription.name}`, hash);
  //   }

  //   await writeFile('./ethscribed.json', JSON.stringify(ethscribed));
  // }

  // async checkDataIntegrity() {
  //   const allPhunks = await this.sbSvc.getAllEthPhunks();
  //   Logger.log(allPhunks.length + ' phunks total');

  //   let count = 0;
  //   const incorrect: any = {};
  //   for (const phunk of allPhunks) {
  //     // console.log(phunk)

  //     const hashId = phunk.hashId.toLowerCase();
  //     const prevOwner = phunk.prevOwner?.toLowerCase() || zeroAddress;

  //     const phunkListing = this.web3Svc.phunksOfferedForSale(hashId);
  //     const phunkBid = this.web3Svc.phunkBids(hashId);
  //     const inEscrow = this.web3Svc.userEthscriptionPossiblyStored(prevOwner, hashId);

  //     const dbBid = this.sbSvc.getBid(hashId);
  //     const dbListing = this.sbSvc.getListing(hashId);

  //     const [listing, bid, escrow, dBid, dListing] = await Promise.all([
  //       phunkListing,
  //       phunkBid,
  //       inEscrow,
  //       dbBid,
  //       dbListing,
  //     ]);

  //     function createHash(h: string) {
  //       if (!incorrect[h]) incorrect[h] = {};
  //     }

  //     // remove listings that exist in the db but not on chain
  //     if (!listing[0] && dListing) {
  //       // this.sbSvc.removeListing(hashId);
  //       createHash(hashId);
  //       incorrect[hashId]['listing'] = true;
  //       Logger.debug('Incorrect Listing (shouldnt be listed in db)', hashId);
  //     }

  //     if (listing[0] && !dListing) {
  //       // this.sbSvc.addListing(hashId, listing[0]);
  //       createHash(hashId);
  //       incorrect[hashId]['listing'] = true;
  //       Logger.debug('Incorrect Listing (shoulod be listed in db)', hashId);
  //     }

  //     // remove bids that exist in the db but not on chain
  //     if (!bid[0] && dBid) {
  //       // this.sbSvc.removeBid(hashId);
  //       createHash(hashId);
  //       incorrect[hashId]['bid'] = true;
  //       Logger.debug('Incorrect Bid (shouldnt have bid in db)', hashId);
  //     }

  //     if (bid[0] && !dBid) {
  //       // this.sbSvc.addBid(hashId, bid[0]);
  //       createHash(hashId);
  //       incorrect[hashId]['bid'] = true;
  //       Logger.debug('Incorrect Bid (should have bid in db)', hashId);
  //     }

  //     if (!escrow && phunk.owner.toLowerCase() === (process.env.MARKET_ADDRESS).toLowerCase()) {
  //       // this.sbSvc.removeEscrow(hashId);
  //       createHash(hashId);
  //       incorrect[hashId]['escrow'] = true;
  //       Logger.debug('Incorrect Escrow (shouldnt have escrow in db)', hashId);
  //     }

  //     if (escrow && phunk.owner.toLowerCase() !== (process.env.MARKET_ADDRESS).toLowerCase()) {
  //       // this.sbSvc.addEscrow(hashId, escrow);
  //       createHash(hashId);
  //       incorrect[hashId]['escrow'] = true;
  //       Logger.debug('Incorrect Escrow (should have escrow in db)', hashId);
  //     }

  //     process.stdout.clearLine(0);
  //     process.stdout.cursorTo(0);
  //     process.stdout.write(`Done with ${count} -- ${hashId}\r`);

  //     count++;
  //   }

  //   await writeFile('incorrect.json', JSON.stringify(incorrect));
  //   Logger.log(Object.keys(incorrect).length + ' incorrect phunks');

  //   this.checkDataIntegrity();
  // }

  // async start() {

  //   const metadata = [];

  //   const items = await this.sbSvc.getAllEthscriptions();

  //   const noTwin = [];
  //   const nogood = [];
  //   const events = [];

  //   let count = 0;
  //   for (const item of items) {

  //     const hashId = item.hashId.toLowerCase();
  //     const creator = item.creator?.toLowerCase();
  //     const owner = item.owner?.toLowerCase();
  //     const prevOwner = item.prevOwner?.toLowerCase();

  //     const twin = await this.dataSvc.checkEthscriptionExistsByHashId(hashId);

  //     if (!twin) {
  //       Logger.error('No twin', hashId);
  //       noTwin.push(hashId);
  //       await writeFile('./notwin.json', JSON.stringify(noTwin));
  //       continue;
  //     }

  //     const transaction_hash = twin.transaction_hash?.toLowerCase();
  //     const e_creator = twin.creator?.toLowerCase();
  //     const current_owner = twin.current_owner?.toLowerCase();
  //     const previous_owner = twin.previous_owner?.toLowerCase();

  //     if (
  //       transaction_hash !== hashId ||
  //       e_creator !== creator ||
  //       current_owner !== owner ||
  //       (prevOwner && previous_owner !== prevOwner)
  //     ) {
  //       nogood.push(transaction_hash);

  //       if (twin.valid_transfers?.length) {
  //         for (const transfer of twin.valid_transfers) {
  //           events.push(transfer.transaction_hash?.toLowerCase());
  //         }
  //       }
  //       await writeFile('./events.json', JSON.stringify(events));
  //       await writeFile('./nogood.json', JSON.stringify(nogood));

  //       console.log({twin});

  //       Logger.error('No consensus', hashId);
  //     } else {
  //       Logger.log(`${count} -- 100% Consensus`, hashId);
  //     }

  //     metadata.push({
  //       hashId,
  //       name: `Phunk #${item.tokenId}`,
  //       attributes: EtherPhunksAttributes[item.sha],
  //       sha: item.sha,
  //     });

  //     count++;
  //   }

  //   await writeFile('./metadata.json', JSON.stringify(metadata));
  // }
}
