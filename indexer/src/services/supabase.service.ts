import { Injectable, Logger } from '@nestjs/common';

import { createClient } from '@supabase/supabase-js';
import { DecodeEventLogReturnType, Log, Transaction } from 'viem';

import { Phunk, Sha, Event, PhunkResponse, ShaResponse, UserResponse, EventType, EventResponse, User, ListingResponse, Listing } from 'src/models/db';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, serviceRole);

const chain: 'mainnet' | 'goerli' = process.env.CHAIN_ID === '5' ? 'goerli' : 'mainnet';

@Injectable()

export class SupabaseService {

  suffix = process.env.CHAIN_ID === '1' ? '' : `_goerli`;

  ////////////////////////////////////////////////////////////////////////////////
  // Processors //////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async processEthscriptionEvent(txn: Transaction, createdAt: Date, cleanedString: string): Promise<void> {
    const content = cleanedString.split('data:image/svg+xml,')[1];
    if (!content) return;

    const { from, to, hash } = txn;
    // Check if the sha already exists in the shas table
    const sha = crypto.createHash('sha256').update(cleanedString).digest('hex');
    const phunkId = await this.checkIsEthPhunks(sha);
    if (!phunkId && phunkId !== 0) return;

    // Check if the sha already exists in the ethPhunks table
    const isDuplicate = await this.checkEthPhunkExistsBySha(sha);
    if (isDuplicate) return;

    // Get or create the users from address
    const [ toUser, fromUser ] = await Promise.all([
      this.getOrCreateUser(from, createdAt),
      this.getOrCreateUser(to, createdAt)
    ]);

    // Add the ethereum phunk
    await this.addEthPhunk(txn, createdAt, phunkId, sha);
    // Add the creation event
    await this.addEvent(txn, from, to, hash, phunkId, 'created', createdAt);
    Logger.log('Added eth phunk', `${phunkId} -- ${hash.toLowerCase()}`);
  }

  async processTransferEvent(txn: Transaction, createdAt: Date): Promise<void> {
    const ethPhunk: Phunk = await this.checkEthPhunkExistsByHash(txn.input);
    if (!ethPhunk) return;

    const { from, to } = txn;
    const isMatchedHashId = ethPhunk.hashId.toLowerCase() === txn.input.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === txn.from.toLowerCase();

    console.log({ isMatchedHashId, transferrerIsOwner });

    if (!isMatchedHashId || !transferrerIsOwner) return;

    // Get or create the users from address
    const [ toUser, fromUser ] = await Promise.all([
      this.getOrCreateUser(from, createdAt),
      this.getOrCreateUser(to, createdAt)
    ]);

    // Update the eth phunk owner
    await this.updateEthPhunkOwner(ethPhunk.hashId, ethPhunk.owner, txn.to);
    // Add the transfer event
    await this.addEvent(txn, from, to, ethPhunk.hashId, ethPhunk.phunkId, 'transfer', createdAt);
    Logger.log('Updated eth phunk owner', `Hash: ${ethPhunk.hashId} -- To: ${txn.to.toLowerCase()}`);
  }

  async processContractEvent(
    txn: Transaction,
    createdAt: Date,
    sender: string,
    recipient: string,
    hashId: string,
    value?: bigint,
    prevOwner?: string,
    log?: Log,
  ): Promise<void> {
    const ethPhunk: Phunk = await this.checkEthPhunkExistsByHash(hashId);
    if (!ethPhunk) return;

    const isMatchedHashId = ethPhunk.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === sender.toLowerCase();

    const samePrevOwner = (ethPhunk.prevOwner && prevOwner) ? ethPhunk.prevOwner.toLowerCase() === prevOwner.toLowerCase() : true;

    if (!isMatchedHashId || !transferrerIsOwner || !samePrevOwner) return;

    // Get or create the users from address
    const [ toUser, fromUser ] = await Promise.all([
      this.getOrCreateUser(sender, createdAt),
      this.getOrCreateUser(recipient, createdAt)
    ]);

    // Add the sale/transfer event
    await this.addEvent(
      txn,
      sender,
      recipient,
      ethPhunk.hashId,
      ethPhunk.phunkId,
      value ? 'sale' : 'transfer',
      createdAt,
      value,
      log.logIndex
    );

    // Update the eth phunk owner
    await this.updateEthPhunkOwner(ethPhunk.hashId, ethPhunk.owner, recipient);
    Logger.log('Updated eth phunk owner (event)', `Hash: ${ethPhunk.hashId} -- To: ${recipient.toLowerCase()}`);
  }

  async processMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType,
  ): Promise<void> {

    const { eventName } = decoded;

    // console.log({ txn, decoded });

    if (eventName === 'PhunkBought') {
      const { fromAddress, toAddress, value, phunkId } = decoded.args as any;
      await this.removeListing(createdAt, phunkId);
    }

    if (eventName === 'PhunkBidEntered') {
      const { phunkId, fromAddress, value } = decoded.args as any;
      await this.createBid(txn, createdAt, phunkId, fromAddress, value);
    }

    if (eventName === 'PhunkBidWithdrawn') {
      const { phunkId } = decoded.args as any;
      await this.removeBid(createdAt, phunkId);
    }

    if (eventName === 'PhunkNoLongerForSale') {
      const { phunkId } = decoded.args as any;
      await this.removeListing(createdAt, phunkId);
    }

    if (eventName === 'PhunkOffered') {
      const { phunkId, toAddress, minValue } = decoded.args as any;
      await this.createListing(txn, createdAt, phunkId, toAddress, minValue);
    }

    if (eventName === 'PotentialEthscriptionDeposited') {}
    if (eventName === 'PotentialEthscriptionWithdrawn') {}
  }

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
      .insert({
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
    Logger.log('Created listing', phunkId);
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

  async checkEthPhunkExistsByHash(hash: string): Promise<Phunk> {
    const response: PhunkResponse = await supabase
      .from('phunks' + this.suffix)
      .select('*')
      .eq('hashId', hash.toLowerCase());

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
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
    value?: bigint,
    logIndex?: number
  ): Promise<void> {
    const response: PhunkResponse = await supabase
      .from('events' + this.suffix)
      .insert([{
        blockTimestamp: createdAt,
        type,
        phunkId,
        value: value ? Number(value) : null,
        hashId: hashId.toLowerCase(),
        from: from.toLowerCase(),
        to: to.toLowerCase(),
        blockNumber: Number(txn.blockNumber),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        txHash: txn.hash.toLowerCase(),
        txId: `${txn.hash.toLowerCase()}_${txn.transactionIndex}_${logIndex || Date.now()}`,
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
