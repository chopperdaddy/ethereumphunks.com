import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { catchError, firstValueFrom, map, of, tap } from 'rxjs';

@Injectable()
export class DataService {

  constructor(
    private readonly http: HttpService
  ) {}

  async checkEthscriptionExistsByHashId(hashId: string): Promise<boolean> {
    return await firstValueFrom(
      this.http.get(`https://api.ethscriptions.com/api/ethscriptions/${hashId}`).pipe(
        map(response => !!response.data?.transaction_hash),
        catchError(error => {
          return of(false);
        }),
      )
    );
  }
}
