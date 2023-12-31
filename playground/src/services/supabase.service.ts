import { Injectable, Logger } from '@nestjs/common';

import { UtilityService } from 'src/utils/utility.service';

import { createClient } from '@supabase/supabase-js';
import { Transaction, hexToString, zeroAddress } from 'viem';
import { writeFile } from 'fs/promises';

import {
  Event,
  ShaResponse,
  UserResponse,
  EventType,
  EventResponse,
  User,
  ListingResponse,
  Bid,
  BidResponse,
  PhunkSha,
  CuratedItem,
  EthscriptionResponse,
  Ethscription,
} from 'src/models/db';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.CHAIN_ID === '1' ? process.env.SUPABASE_URL_MAINNET : process.env.SUPABASE_URL_GOERLI;
const serviceRole = process.env.CHAIN_ID === '1' ? process.env.SUPABASE_SERVICE_ROLE_MAINNET : process.env.SUPABASE_SERVICE_ROLE_GOERLI;

const supabase = createClient(supabaseUrl, serviceRole);

@Injectable()
export class SupabaseService {
  suffix = process.env.CHAIN_ID === '1' ? '' : '_goerli';

  constructor(
    private readonly utilSvc: UtilityService
  ) {}

  async updateLastBlock(blockNumber: number, createdAt: Date): Promise<void> {
    const response = await supabase
      .from('blocks')
      .upsert({
        network: process.env.CHAIN_ID,
        blockNumber,
        createdAt,
      });

    const { error } = response;
    if (error) throw error;
  }

  async getLastBlock(network: number): Promise<any> {
    const response = await supabase
      .from('blocks')
      .select('*')
      .eq('network', network);

    const { data, error } = response;
    if (error) throw error;
    if (data?.length) return data[0]?.blockNumber;
    return null;
  }

  async checkEthscriptionExistsBySha(sha: string): Promise<boolean> {
    const response: EthscriptionResponse = await supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (!data?.length) return false;
    return true;
  }

  async checkEthscriptionExistsByHashId(hash: string): Promise<Ethscription> {
    const response: EthscriptionResponse = await supabase
      .from('ethscriptions' + this.suffix)
      .select('*')
      .eq('hashId', hash.toLowerCase());

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
    return null;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Adds ////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async addEthPhunk(
    txn: Transaction,
    createdAt: Date,
    phunkShaData: PhunkSha
  ): Promise<void> {

    const stringData = hexToString(txn.input.toString() as `0x${string}`);
    const cleanedString = stringData.replace(/\x00/g, '');

    // Get or create the users
    await Promise.all([
      this.getOrCreateUser(txn.from, createdAt),
      this.getOrCreateUser(txn.to, createdAt)
    ]);

    const response: EthscriptionResponse = await supabase
      .from('ethscriptions' + this.suffix)
      .insert([
        {
          createdAt,
          creator: txn.from.toLowerCase(),
          owner: txn.to.toLowerCase(),
          hashId: txn.hash.toLowerCase(),
          data: cleanedString,
          sha: phunkShaData.sha,
          slug: 'etherphunks',
          tokenId: phunkShaData.phunkId,
        },
      ]);

    const { error } = response;
    if (error) throw error.message;
  }

  async addCurated(
    txn: Transaction,
    createdAt: Date,
    curatedItem: CuratedItem
  ): Promise<void> {

    const stringData = hexToString(txn.input?.toString() as `0x${string}`);
    const cleanedString = stringData.replace(/\x00/g, '');

    // Get or create the users
    await Promise.all([
      this.getOrCreateUser(txn.from, createdAt),
      this.getOrCreateUser(txn.to, createdAt)
    ]);

    const response: EthscriptionResponse = await supabase
      .from('ethscriptions' + this.suffix)
      .insert([
        {
          createdAt,
          creator: txn.from.toLowerCase(),
          owner: txn.to.toLowerCase(),
          hashId: txn.hash.toLowerCase(),
          data: cleanedString,
          sha: curatedItem.sha,
          slug: curatedItem.slug,
          tokenId: curatedItem.tokenId,
        },
      ]);

    const { error } = response;
    if (error) throw error.message;
    else Logger.log('Added curated', `${curatedItem.name}`);
  }

  async addEvent(
    txn: Transaction,
    from: string,
    to: string,
    hashId: string,
    type: EventType,
    createdAt: Date,
    value: bigint,
    logIndex: number
  ): Promise<void> {
    // Get or create the users
    await Promise.all([
      this.getOrCreateUser(from, createdAt),
      this.getOrCreateUser(to, createdAt),
    ]);

    const txId = `${txn.hash.toLowerCase()}-${logIndex}`;
    const response: EthscriptionResponse = await supabase
      .from('events' + this.suffix)
      .upsert({
        txId,
        blockTimestamp: createdAt,
        type,
        value: value.toString(),
        hashId: hashId.toLowerCase(),
        from: from.toLowerCase(),
        to: (to || zeroAddress).toLowerCase(),
        blockNumber: Number(txn.blockNumber),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        txHash: txn.hash.toLowerCase(),
      }, {
        ignoreDuplicates: true,
      });

    const { error } = response;
    if (error) Logger.error(error.message, txn.hash.toLowerCase());
    Logger.log('Event created', txn.hash.toLowerCase());
  }

  async addEvents(events: Event[]): Promise<void> {
    const response: EventResponse = await supabase
      .from('events' + this.suffix)
      .upsert(events, {
        ignoreDuplicates: true,
      });

    const { error } = response;
    if (error) throw error.message;
    Logger.log(`${events.length} events created`, `Block ${events[0].blockNumber.toString()}`);
  }

  async addSha(phunkId: string, sha: string): Promise<PhunkSha> {
    const response: ShaResponse = await supabase
      .from('phunk_shas' + this.suffix)
      .insert({ sha, phunkId });

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }

  async getOrCreateUser(address: string, createdAt?: Date): Promise<User> {
    if (!address) return null;
    address = address.toLowerCase();

    const response: UserResponse = await supabase
      .from('users' + this.suffix)
      .select('*')
      .eq('address', address);

    const { data, error } = response;

    if (error) throw error;
    if (data.length) return data[0];

    const newUserResponse: UserResponse = await supabase
      .from('users' + this.suffix)
      .insert({ address, createdAt: createdAt || new Date() })
      .select();

    const { data: newUser, error: newError } = newUserResponse;

    if (newError) throw newError.message;
    Logger.log('User created', address);
    if (newUser?.length) return newUser[0];
  }

  async getAllEthscriptions(): Promise<any[]> {

    const pageSize = 1000; // Max rows per request

    let allPhunks: any[] = [];
    let hasMore = true;
    let page = 0;

    while (hasMore) {
      const { data, error } = await supabase
        .from('ethscriptions' + this.suffix)
        .select('hashId')
        // .eq('slug', 'missing-punks')
        .order('createdAt', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching data:', error);
        throw error;
      }

      if (data) {
        allPhunks = allPhunks.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allPhunks;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Updates /////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async updateEthscriptionData(hashId: string, sha: string, data: string): Promise<void> {
    const response: EthscriptionResponse = await supabase
      .from('ethscriptions' + this.suffix)
      .update({ sha, data })
      .eq('hashId', hashId.toLowerCase());

    const { error } = response;
    if (error) throw error;
    Logger.log('Updated ethscription data', hashId);
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Images //////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async uploadFile(curatedItem: {
    name: string;
    image: string;
    attributes: {k: string, v: string}[];
    slug: string;
    tokenId: number | null;
    sha: string;
  }): Promise<void> {

    const imageBlob = this.utilSvc.dataURLtoBuffer(curatedItem.image);
    const fileName = `${curatedItem.sha}_${this.suffix}.png`;

    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, imageBlob)

    if (error) Logger.error(error.message, 'Error uploading image');
    if (data) Logger.log('Uploaded curated file', `${fileName}`);
  }

  async uploadImage(
    png: Buffer,
    sha: string
  ): Promise<void> {
    const fileName = `${sha}.png`;

    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, png, { contentType: 'image/png' })

    if (error) Logger.error(error.message, 'Error uploading image');
    if (data) Logger.log('Uploaded curated file', `${fileName}`);
  }

}
