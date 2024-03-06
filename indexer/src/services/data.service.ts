import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { catchError, firstValueFrom, map, of, tap } from 'rxjs';

import dotenv from 'dotenv';
dotenv.config();

const prefix = process.env.CHAIN_ID === '1' ? '' : 'sepolia-';

@Injectable()
export class DataService {

  constructor(
    private readonly http: HttpService
  ) {}

  async checkEthscriptionExistsByHashId(hashId: string): Promise<boolean> {
    return await firstValueFrom(
      this.http.get(`https://${prefix}api-v2.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
        map(response => !!response.data?.transaction_hash),
        catchError(error => {
          return of(false);
        }),
      )
    );
  }

  checkConsensus(owner: string, hashId: string): any {
    return firstValueFrom(
      this.http.get(`https://${prefix}api-v2.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
        map(response => {
          if (response.data?.current_owner?.toLowerCase() === owner.toLowerCase()) return true;
          return false;
        }),
        catchError(error => {
          return of(false);
        }),
      )
    );
  }
}
