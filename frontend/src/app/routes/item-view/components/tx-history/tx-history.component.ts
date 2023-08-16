import { AfterViewInit, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { CamelCase2TitleCase } from '@/pipes/cc2tc.pipe';

import { DataService } from '@/services/data.service';

import { BehaviorSubject, Subject, catchError, filter, map, of, switchMap, takeUntil, tap } from 'rxjs';

import { Apollo, gql } from 'apollo-angular';
import { ApolloQueryResult } from '@apollo/client';

import { Event } from '@/models/graph';

import { ZERO_ADDRESS } from '@/constants/utils';

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

export class TxHistoryComponent implements AfterViewInit, OnDestroy, OnChanges {

  ZERO_ADDRESS = ZERO_ADDRESS;

  @Input() tokenId!: string;

  private activeTokenId = new BehaviorSubject<string | undefined>(undefined);
  activeTokenId$ = this.activeTokenId.asObservable();

  private tokenSales = new BehaviorSubject<Event[] | null>(null);
  tokenSales$ = this.tokenSales.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    private apollo: Apollo,
    public dataSvc: DataService
  ) {

    this.activeTokenId$.pipe(
      filter((res) => !!res),
      switchMap((res) => {

        const GET_DATA = gql`
          query GetEvents {
            events(
              where: {
                tokenId: "${res}",
                # type_not: "OfferWithdrawn"
              },
              orderBy: blockTimestamp,
              orderDirection: desc
            ) {
              type
              value
              usd
              transactionHash
              blockTimestamp
              fromAccount {
                id
              }
              toAccount {
                id
              }
            }
          }
        `;

        return this.apollo.watchQuery<{ events: Event[] }>({
          query: GET_DATA,
          pollInterval: 5000,
          errorPolicy: 'all'
        }).valueChanges.pipe(
          map((res: ApolloQueryResult<{ events: Event[] }>) => res.data?.events || null),
          tap((res) => console.log(res)),
        );
      }),
      tap((res: Event[]) => console.log('TxHistoryComponent', res)),
      tap((res: Event[]) => this.tokenSales.next(res)),
      takeUntil(this.destroy$),
      catchError((err) => {
        console.log(err);
        return of(null);
      })
    ).subscribe();

  }

  ngAfterViewInit(): void {
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    this.activeTokenId.next(changes.tokenId.currentValue);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
