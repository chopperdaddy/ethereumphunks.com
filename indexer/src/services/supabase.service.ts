import { Injectable, Logger } from '@nestjs/common';

import { createClient } from '@supabase/supabase-js';
import { Transaction } from 'viem';

import { EthPhunk, Sha, EthPhunkResponse, ShaResponse, UserResponse } from 'src/models/db';

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, serviceRole);

@Injectable()

export class SupabaseService {

  suffix = '_mkt';

  ////////////////////////////////////////////////////////////////////////////////
  // Processors //////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async processEthscriptionEvent(txn: Transaction, createdAt: Date, cleanedString: string): Promise<void> {

    const content = cleanedString.split('data:image/svg+xml,')[1];
    if (!content) return;

    // Check if the sha already exists in the shas table
    const sha = crypto.createHash('sha256').update(cleanedString).digest('hex');
    const ethPhunkId = await this.checkIsEthPhunks(sha);
    if (!ethPhunkId && ethPhunkId !== 0) return;

    // Check if the sha already exists in the ethPhunks table
    const isDuplicate = await this.checkEthPhunkExistsBySha(sha);
    if (isDuplicate) return;

    // Add the ethereum phunk
    await this.addEthPhunk(txn, createdAt, ethPhunkId, sha);
    Logger.log('Added eth phunk', `${ethPhunkId} -- ${txn.hash.toLowerCase()}`);
  }

  async processTransferEvent(txn: Transaction, createdAt: Date): Promise<void> {
    const ethPhunk: EthPhunk = await this.checkEthPhunkExistsByHash(txn.input);
    if (!ethPhunk) return;

    const isMatched = ethPhunk.hashId.toLowerCase() === txn.input.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === txn.from.toLowerCase();

    if (!isMatched || !transferrerIsOwner) return;

    await this.addEthPhunkTransfer(txn, createdAt);
    await this.updateEthPhunkOwner(ethPhunk.hashId, txn.to);
    Logger.log('Updated eth phunk owner', `Hash: ${ethPhunk.hashId} -- To: ${txn.to.toLowerCase()}`);
  }

  async processMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    sender: string,
    recipient: string,
    ethscriptionId: string
  ): Promise<void> {
    const ethPhunk: EthPhunk = await this.checkEthPhunkExistsByHash(ethscriptionId);
    if (!ethPhunk) return;

    const isMatched = ethPhunk.hashId.toLowerCase() === ethscriptionId.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === sender.toLowerCase();

    if (!isMatched || !transferrerIsOwner) return;

    await this.addEthPhunkTransfer(txn, createdAt);
    await this.updateEthPhunkOwner(ethPhunk.hashId, recipient);
    Logger.log('Updated eth phunk owner (event)', `Hash: ${ethPhunk.hashId} -- To: ${recipient.toLowerCase()}`);
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Checks //////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async checkIsEthPhunks(sha: string): Promise<number | null> {
    const response: ShaResponse = await supabase
      .from('shas' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0].id;
    return null;
  }

  async checkEthPhunkExistsBySha(sha: string): Promise<boolean> {
    const response: EthPhunkResponse = await supabase
      .from('ethPhunks' + this.suffix)
      .select('*')
      .eq('sha', sha);

    const { data, error } = response;

    if (error) throw error;
    if (!data.length) return false;
    return true;
  }

  async checkEthPhunkExistsByHash(hash: string): Promise<EthPhunk> {
    const response: EthPhunkResponse = await supabase
      .from('ethPhunks' + this.suffix)
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

    const response: EthPhunkResponse = await supabase
      .from('ethPhunks' + this.suffix)
      .insert([{
        createdAt,
        creator: txn.from.toLowerCase(),
        owner: txn.to.toLowerCase(),
        hashId: txn.hash.toLowerCase(),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        data: txn.input,
        sha,
        phunkId
      }]);

    const { error } = response;
    if (error) throw error.message;
  }

  async addEthPhunkTransfer(txn: Transaction, createdAt: Date): Promise<void> {
    const response: EthPhunkResponse = await supabase
      .from('ethPhunkTransfers' + this.suffix)
      .insert([{
        createdAt,
        hashId: txn.input.toLowerCase(),
        from: txn.from.toLowerCase(),
        to: txn.to.toLowerCase(),
        blockNumber: Number(txn.blockNumber),
        blockHash: txn.blockHash.toLowerCase(),
        txIndex: Number(txn.transactionIndex),
        txHash: txn.hash.toLowerCase()
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

  async getOrCreateUser(address: string) {
    address = address.toLowerCase();

    const response: UserResponse = await supabase
      .from('users' + this.suffix)
      .select('*')
      .eq('address', address);

    const { data, error } = response;

    if (error) throw error;
    if (data.length) return data[0];

    const newUserResponse: UserResponse = await supabase
      .from('users')
      .insert([{ address }]);

    const { data: newUser, error: newError } = newUserResponse;

    if (newError) throw newError.message;
    if (newUser?.length) return newUser[0];
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Updates /////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async updateEthPhunkOwner(hashId: string, newOwner: string): Promise<void> {
    const response: EthPhunkResponse = await supabase
      .from('ethPhunks' + this.suffix)
      .update({ owner: newOwner.toLowerCase() })
      .eq('hashId', hashId);

    const { error } = response
    if (error) throw error;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Gets ////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  async getPhunkById(phunkId: string): Promise<EthPhunk> {
    const response: EthPhunkResponse = await supabase
      .from('ethPhunks' + this.suffix)
      .select('*')
      .eq('phunkId', phunkId);

    const { data, error } = response;

    if (error) throw error;
    if (data?.length) return data[0];
  }
}
