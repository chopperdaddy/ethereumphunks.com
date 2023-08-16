import { Injectable } from '@nestjs/common';

import { Web3Service } from './web3.service';
import { SupabaseService } from './supabase.service';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class PlaygroundService {

  constructor(
    private readonly ethSvc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {}


}
