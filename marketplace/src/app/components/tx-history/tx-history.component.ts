import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { CamelCase2TitleCase } from '@/pipes/cc2tc.pipe';

import { DataService } from '@/services/data.service';

import { BehaviorSubject, Subject, catchError, filter, of, switchMap, takeUntil, tap } from 'rxjs';

import { Event } from '@/models/graph';

import { ZERO_ADDRESS } from '@/constants/utils';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    RouterModule,

    LazyLoadImageModule,

    WalletAddressDirective,

    WeiToEthPipe,
    FormatCashPipe,
    CamelCase2TitleCase
  ],
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss']
})

export class TxHistoryComponent implements OnDestroy, OnChanges {

  ZERO_ADDRESS = ZERO_ADDRESS;

  @Input() hashId!: string | undefined;

  explorerUrl = `https://${environment.chainId === 5 ? 'goerli.' : ''}etherscan.io`;

  private activeHashId = new BehaviorSubject<string | undefined>(undefined);
  activeHashId$ = this.activeHashId.asObservable();

  private tokenSales = new BehaviorSubject<Event[] | null>(null);
  tokenSales$ = this.tokenSales.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    public dataSvc: DataService
  ) {
    this.activeHashId$.pipe(
      filter((res) => !!res),
      switchMap((res) => this.dataSvc.fetchSingleTokenEvents(res as string)),
      tap((res: Event[]) => this.tokenSales.next(res)),
      takeUntil(this.destroy$),
      catchError((err) => {
        console.log(err);
        return of(null);
      })
    ).subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.activeHashId.next(changes.hashId.currentValue);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
