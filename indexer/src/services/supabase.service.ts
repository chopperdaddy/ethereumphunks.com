import { Injectable, Logger } from '@nestjs/common';

import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';
import { Transaction } from 'viem';

import { EthPhunk } from 'src/models/ethPhunk';

import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, serviceRole);

@Injectable()

export class SupabaseService {

  async processEthscriptionEvent(txn: Transaction, createdAt: Date, cleanedString: string): Promise<void> {

    const content = cleanedString.split('data:image/svg+xml,')[1];
    if (!content) return;

    const sha = crypto.createHash('sha256').update(cleanedString).digest('hex');

    // Check if the sha already exists in the shas table
    const ethPhunkId = await this.checkIsEthPhunks(sha);
    if (!ethPhunkId) return;

    // Check if the sha already exists in the ethPhunks table
    const isDuplicate = await this.checkEthPhunkExistsBySha(sha);
    if (isDuplicate) return;

    // Add the ethereum phunk
    await Promise.all([
      this.addEthPhunk(txn, createdAt, ethPhunkId, sha),
      // this.addEthscription(txn, createdAt)
    ]);
  }

  async processTransferEvent(txn: Transaction): Promise<void> {
    const ethPhunk: EthPhunk = await this.checkEthPhunkExistsByHash(txn.input.toLowerCase());
    if (!ethPhunk) return;

    const isMatched = ethPhunk.hashId.toLowerCase() === txn.input.toLowerCase();
    const transferrerIsOwner = ethPhunk.owner.toLowerCase() === txn.from.toLowerCase();

    if (!isMatched || !transferrerIsOwner) return;

    await this.updateEthPhunkOwner(ethPhunk.hashId, txn.to.toLowerCase());
    Logger.log('Updated eth phunk owner', `Hash: ${ethPhunk.hashId} -- To: ${txn.to.toLowerCase()}`);
  }

  async checkIsEthPhunks(sha: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('shas')
      .select('*')
      .eq('sha', sha);

    if (error) throw error;
    if (!data.length) return null;

    return data[0].id;
  }

  async checkEthPhunkExistsBySha(sha: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ethPhunks')
      .select('*')
      .eq('sha', sha);

    if (error) throw error;
    if (!data.length) return false;
    return true;
  }

  async checkEthPhunkExistsByHash(hash: string): Promise<EthPhunk> {
    const { data, error } = await supabase
      .from('ethPhunks')
      .select('*')
      .eq('hashId', hash);

    if (error) throw error;
    if (data.length) return data[0];
  }

  async addEthPhunk(
    txn: Transaction,
    createdAt: Date,
    phunkId: string,
    sha: string
  ): Promise<any> {
    const { data, error } = await supabase
      .from('ethPhunks')
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

    if (error) throw error.message;

    Logger.log('Added eth phunk', `${phunkId} -- ${txn.hash.toLowerCase()}`);
    return data[0];
  }

  async getOrCreateUser(address: string) {
    address = address.toLowerCase();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('address', address);

    if (error) throw error;
    if (data.length) return data[0];

    const { data: newUser, error: newError } = await supabase
      .from('users')
      .insert([{ address }]);

    if (newError) throw newError.message;
    return newUser[0];
  }

  async updateEthPhunkOwner(hashId: string, newOwner: string): Promise<any> {
    const { data, error } = await supabase
      .from('ethPhunks')
      .update({ owner: newOwner.toLowerCase() })
      .eq('hashId', hashId);

    if (error) throw error;
    if (data.length) return data[0];
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // ETH PHUNKS ////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async addSha(phunkId: string, sha: string): Promise<any> {

    const { data, error } = await supabase
      .from('shas')
      .insert({ id: phunkId, sha, phunkId })
      // .eq('id', phunkId);

    // console.log('addSha', data, error);

    if (error) throw error;
    if (data.length) return data[0];
  }

}
