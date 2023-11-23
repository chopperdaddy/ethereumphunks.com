import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

import { Phunk } from '@/models/db';
import { GlobalState, Transaction } from '@/models/global-state';

import { Web3Service } from '@/services/web3.service';

import { PhunkGridComponent } from '@/components/shared/phunk-grid/phunk-grid.component';
import { TxModalComponent } from '@/components/tx-modal/tx-modal.component';
import { NotifComponent } from '@/components/shared/notif/notif.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import anime from 'animejs';

import { map, tap } from 'rxjs';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    IntersectionObserverModule,
    RouterModule,

    PhunkGridComponent,
    NotifComponent,
    TxModalComponent,

    WeiToEthPipe,

    WalletAddressDirective
  ],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements AfterViewInit {

  @ViewChild('menuInner') menuInner!: ElementRef;

  address$ = this.store.select(appStateSelectors.selectWalletAddress);
  menuActive$ = this.store.select(appStateSelectors.selectMenuActive);

  listedPhunks$ = this.store.select(dataStateSelectors.selectOwnedPhunks).pipe(
    tap((owned: Phunk[] | null) => this.createOwnedStats(owned)),
    map((res) => res?.filter((phunk: Phunk) => phunk.listing)),
  );

  userOpenBids$ = this.store.select(dataStateSelectors.selectUserOpenBids).pipe(
    tap((bids: Phunk[] | null) => this.createBidStats(bids))
  );

  transactions$ = this.store.select(appStateSelectors.selectTransactions).pipe(
    map((txns: Transaction[]) => [...txns].sort((a, b) => b.id - a.id))
  );

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  hasWithdrawal$ = this.store.select(appStateSelectors.selectHasWithdrawal);

  stats: any = {
    owned: 0,
    escrowed: 0,
    listed: 0,
  };

  menuTimeline!: anime.AnimeTimelineInstance;

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private el: ElementRef,
  ) {
    el.nativeElement.style.transform = 'translateY(-100%)';
  }

  ngAfterViewInit(): void {

    this.menuActive$.pipe(
      tap((active: boolean) => console.log(`Menu active: ${active}`)),
      tap((active: boolean) => {
        anime.timeline({
          easing: 'cubicBezier(0.785, 0.135, 0.15, 0.86)',
          duration: 400,
        }).add({
          targets: this.el?.nativeElement,
          translateY: active ? '0%' : '-100%',
        }).add({
          targets: this.menuInner?.nativeElement,
          opacity: active ? 1 : 0,
        });
      })
    ).subscribe();

    this.store.dispatch(dataStateActions.fetchUserOpenBids());
  }

  createOwnedStats(owned: Phunk[] | null) {
    if (!owned) return;

    // Get all the attributes
    const allTraits = owned?.map((phunk: Phunk) => phunk.attributes);
    const traits = allTraits?.reduce((acc: any, val: any) => acc.concat(val), []);

    // Count the occurrences of each attribute
    const traitCounts = traits?.reduce((acc: {[key: string]: number}, trait: {k: string, v: string}) => {
      const key = `${trait.k}:${trait.v}`; // creates a unique key from the k:v pair
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const males = traitCounts?.['Sex:Male'] || 0;
    const females = traitCounts?.['Sex:Female'] || 0;

    // console.log(`Males: ${males}, Females: ${females}`);

    // Remove the counts for "Male" and "Female" to get rare traits excluding "Sex"
    delete traitCounts?.['Sex:Male'];
    delete traitCounts?.['Sex:Female'];

    // Convert the frequency object to a sorted array of [key, count] pairs
    const sortedTraits = traitCounts ? Object.entries(traitCounts).sort((a: any, b: any) => a[1] - b[1]) : []; // Note: We sort in ascending order now to get the rarest

    // Get the top 3 most rare traits
    const top3RarestTraits = sortedTraits.slice(0, 3);

    // console.log(top3RarestTraits);

    const escrowed = owned?.filter((phunk: Phunk) => phunk.isEscrowed)?.length;
    const listed = owned?.filter((phunk: Phunk) => phunk.listing)?.length;

    this.stats = {
      ...this.stats,
      owned: owned?.length,
      escrowed,
      listed,
    };
  }

  createBidStats(bids: Phunk[] | null) {
    if (!bids) return;

    const totalBidValue = bids.reduce((acc, phunk) => {
      const val = this.web3Svc.weiToEth(phunk.bid?.value) || '0';
      return acc + Number(val);
    }, 0);

    this.stats = {
      ...this.stats,
      bids: bids?.length,
      bidsValue: totalBidValue,
    };
  }

  async disconnect(): Promise<void> {
    await this.web3Svc.disconnectWeb3();
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }

  async withdraw(): Promise<void> {
    await this.web3Svc.withdraw();
  }
}
