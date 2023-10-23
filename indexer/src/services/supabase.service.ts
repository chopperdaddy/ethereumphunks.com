import { Injectable, Logger } from '@nestjs/common';

import { createClient } from '@supabase/supabase-js';
import { Transaction, zeroAddress } from 'viem';

import {
  Phunk,
  Sha,
  Event,
  PhunkResponse,
  ShaResponse,
  UserResponse,
  EventType,
  EventResponse,
  User,
  ListingResponse,
} from 'src/models/db';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, serviceRole);

@Injectable()

export class SupabaseService {

  suffix = process.env.CHAIN_ID === '1' ? '' : '_goerli';

  async removeBid(createdAt: Date, phunkId: number): Promise<void> {
    const response: ListingResponse = await supabase
      .from('bids' + this.suffix)
      .delete()
      .eq('hashId', phunkId);
    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Removed bid', phunkId);
  }

  async createBid(
    txn: Transaction,
    createdAt: Date,
    phunkId: string,
    fromAddress: string,
    value: bigint
  ): Promise<void> {
    const response: ListingResponse = await supabase
      .from('bids' + this.suffix)
      .insert({
        createdAt,
        hashId: phunkId,
        value: value.toString(),
        fromAddress,
        txHash: txn.hash.toLowerCase(),
      });

    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Created bid', phunkId);
  }

  async createListing(
    txn: Transaction,
    createdAt: Date,
    phunkId: string,
    toAddress: string,
    minValue: bigint
  ): Promise<void> {
    const response: ListingResponse = await supabase
      .from('listings' + this.suffix)
      .upsert({
        hashId: phunkId,
        createdAt,
        txHash: txn.hash.toLowerCase(),
        listed: true,
        minValue: minValue.toString(),
        listedBy: txn.from.toLowerCase(),
        toAddress,
      });

    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Listing created', phunkId);
  }

  async removeListing(createdAt: Date, phunkId: number): Promise<void> {
    const response: ListingResponse = await supabase
      .from('listings' + this.suffix)
      .delete()
      .eq('hashId', phunkId);
    const { error } = response;
    if (error) return Logger.error(error.details, error.message);
    Logger.log('Removed listing', phunkId);
  }

  async updateListing() {

  }

  ////////////////////////////////////////////////////////////////////////////////
  // Checks //////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async checkIsEthPhunks(sha: string): Promise<number | null> {
    const response: ShaResponse = await supabase
      .from('shas')
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0].id;
    return null;
  }

  async checkEthPhunkExistsBySha(sha: string): Promise<boolean> {
    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (!data.length) return false;
    return true;
  }

  async checkEthPhunkExistsByHashId(hash: string): Promise<Phunk> {
    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
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

  async addEthPhunk(txn: Transaction, createdAt: Date, phunkId: number, sha: string): Promise<void> {

    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
      .insert([{
        createdAt,
        creator: txn.from.toLowerCase(),
        owner: txn.to.toLowerCase(),
        hashId: txn.hash.toLowerCase(),
        data: txn.input,
        sha,
        phunkId
      }]);

    const { error } = response;
    if (error) throw error.message;
  }

  async addEvent(
    txn: Transaction,
    from: string,
    to: string,
    hashId: string,
    phunkId: number,
    type: EventType,
    createdAt: Date,
    value: bigint,
    logIndex: number
  ): Promise<void> {

    const txId = `${txn.hash.toLowerCase()}-${logIndex}`;

    const response: PhunkResponse = await supabase
      .from('events' + this.suffix)
      .insert([{
        txId,
        blockTimestamp: createdAt,
        type,
        phunkId,
        value: value ? Number(value) : null,
        hashId: hashId.toLowerCase(),
        from: from.toLowerCase(),
        to: (to || zeroAddress).toLowerCase(),
        blockNumber: Number(txn.blockNumber),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        txHash: txn.hash.toLowerCase(),
      }]);

    const { error } = response;
    if (error) Logger.error(error.message, txn.hash.toLowerCase());
  }

  async addSha(phunkId: string, sha: string): Promise<Sha> {
    const response: ShaResponse = await supabase
      .from('shas' + this.suffix)
      .insert({ id: phunkId, sha, phunkId });

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }

  async getOrCreateUser(address: string, createdAt?: Date): Promise<User> {
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
      .insert({ address, createdAt: new Date() })
      .select();

    const { data: newUser, error: newError } = newUserResponse;

    if (newError) throw newError.message;
    Logger.log('User created', address);
    if (newUser?.length) return newUser[0];
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Updates /////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async updateEthPhunkOwner(hashId: string, prevOwner: string, newOwner: string): Promise<void> {
    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
      .update({
        owner: newOwner.toLowerCase(),
        prevOwner: prevOwner.toLowerCase()
      })
      .eq('hashId', hashId);

    const { error } = response
    if (error) throw error;
  }

  async updateEvent(eventId: number, data: any): Promise<void> {
    const response: EventResponse = await supabase
      .from('events' + this.suffix)
      .update(data)
      .eq('id', eventId);

    const { error } = response
    if (error) throw error;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Gets ////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async getPhunkById(phunkId: string): Promise<Phunk> {
    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
      .select('*')
      .eq('phunkId', phunkId);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }

  async getAllTransfers(): Promise<Event[]> {
    const response: EventResponse = await supabase
      .from('events' + this.suffix)
      .select('*')
      .eq('type', 'transfer');

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data;
  }

}
