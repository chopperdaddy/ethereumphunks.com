import { Injectable } from '@angular/core';

import { Web3Service } from './web3.service';
import { Observable, catchError, from, of, switchMap } from 'rxjs';

// import { Store } from '@ngrx/store';
// import { AppState } from '@/models/global-state';
// import * as actions from '@/state/actions/app-state.action';

@Injectable({
  providedIn: 'root'
})

export class TransactionService {

  constructor(
    // private store: Store<AppState>,
    private web3Svc: Web3Service
  ) {}

  sendToEscrow(tokenId: string): Observable<string | undefined> {
    return from(this.web3Svc.sendEthscriptionToContract(tokenId)).pipe(
      catchError((err) => of(undefined))
    );
  }

  withdrawPhunk(tokenId: string): Observable<string | undefined> {
    return from(this.web3Svc.withdrawPhunk(tokenId)).pipe(
      catchError((err) => of(undefined))
    );
  }

  offerPhunkForSale(tokenId: string, amount: number, address: string | null | undefined): Observable<string | undefined> {
    return from(this.web3Svc.offerPhunkForSale(tokenId, amount)).pipe(
      catchError((err) => of(undefined))
    );
  }

  enterBidForPhunk(tokenId: string, amount: number): Observable<string | undefined> {
    return from(this.web3Svc.enterBidForPhunk(tokenId, amount)).pipe(
      catchError((err) => of(undefined))
    );
  }

  acceptBidForPhunk(tokenId: string, value: string | undefined): Observable<string | undefined> {
    if (!value) return of(undefined);
    return from(this.web3Svc.acceptBidForPhunk(tokenId, value)).pipe(
      catchError((err) => of(undefined))
    );
  }

  withdrawBidForPhunk(tokenId: string): Observable<string | undefined> {
    return from(this.web3Svc.withdrawBidForPhunk(tokenId)).pipe(
      catchError((err) => of(undefined))
    );
  }

  buyPhunk(tokenId: string, value: string | undefined): Observable<string | undefined> {
    if (!value) return of(undefined);
    return from(this.web3Svc.buyPhunk(tokenId, value)).pipe(
      catchError((err) => of(undefined))
    );
  }

  transferPhunk(tokenId: string, address: string | null | undefined): Observable<string | undefined> {
    if (!address) return of(undefined);
    return from(this.web3Svc.transferPhunk(tokenId, address)).pipe(
      catchError((err) => of(undefined))
    );
  }

  phunkNoLongerForSale(tokenId: string): Observable<string | undefined> {
    return from(this.web3Svc.phunkNoLongerForSale(tokenId)).pipe(
      catchError((err) => of(undefined))
    );
  }

  waitForTransaction(hash: string): Observable<any> {
    return from(this.web3Svc.waitForTransaction(hash)).pipe(
      catchError((err) => of(undefined))
    );
  }
}
