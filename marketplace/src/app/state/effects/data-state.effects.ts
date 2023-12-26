import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { GlobalState } from '@/models/global-state';
import { Attribute, Event, Phunk } from '@/models/db';

import { DataService } from '@/services/data.service';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { asyncScheduler, catchError, combineLatest, filter, map, of, switchMap, tap, throttleTime, withLatestFrom } from 'rxjs';

import { Web3Service } from '@/services/web3.service';

@Injectable()
export class DataStateEffects {

  // When the database is updated
  dbEventTriggered$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.dbEventTriggered),
    withLatestFrom(
      this.store.select(dataStateSelectors.selectSinglePhunk)
    ),
    map(([action, singlePhunk]) => {
      // Check if the event is for the active phunk
      const newEvent = action.payload.new as Event;
      this.checkEventIsActiveSinglePhunk(newEvent, singlePhunk);
      return newEvent;
    }),
    // Start with the throttle
    throttleTime(3000, asyncScheduler, {
      leading: true, // emit the first value immediately
      trailing: true // emit the last value in the window
    }),
    withLatestFrom(
      this.store.select(appStateSelectors.selectWalletAddress),
      this.store.select(appStateSelectors.selectEventTypeFilter),
    ),
    tap(([newData, address, eventTypeFilter]) => {
      // Check if the event involved the active user
      // this.checkEventForPurchaseFromUser(newData, address);

      // Fetch market data
      // this.store.dispatch(dataStateActions.fetchOwnedPhunks());
      // this.store.dispatch(dataStateActions.fetchMarketData());

      // Update points
      // this.store.dispatch(appStateActions.fetchUserPoints());

      // Reset the event type filter (triggers a fetch of events)
      // this.store.dispatch(appStateActions.setEventTypeFilter({ eventTypeFilter }));
    }),
  ), { dispatch: false });

  onBlockNumber$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.newBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    switchMap(([action, address]) => {
      const currentBlock = action.blockNumber;
      const storedBlock = localStorage.getItem('EtherPhunks_currentBlock');
      // console.log('onBlockNumber', currentBlock, storedBlock);
      if (storedBlock && (currentBlock - Number(storedBlock)) > 2) {
        return this.dataSvc.fetchMissedEvents(address, Number(storedBlock)).pipe(
          tap((events) => {
            for (const event of events) this.checkEventForPurchaseFromUser(event, address);
          }),
          catchError((err) => of([])),
        );
      }
      return of([]);
    }),
    withLatestFrom(this.store.select(appStateSelectors.selectBlockNumber)),
    tap(([_, blockNumber]) => localStorage.setItem('EtherPhunks_currentBlock', JSON.stringify(blockNumber))),
  ), { dispatch: false });

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchMarketData),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        tap((slug) => console.log('fetchMarketData', slug)),
        filter((slug) => !!slug),
        switchMap((slug) => this.dataSvc.fetchMarketData(slug)),
      )
    }),
    map((marketData) => dataStateActions.setMarketData({ marketData }))
  ));

  fetchCollections$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchCollections),
    switchMap(() => this.dataSvc.fetchCollections()),
    map((collections) => dataStateActions.setCollections({ collections })),
  ));

  setCollections$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.setCollections),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        map((slug) => {
          // console.log({slug})
          const coll = action.collections.find((c) => c.slug === slug);
          // console.log({coll})
          if (!coll) return dataStateActions.setActiveCollection({ activeCollection: action.collections[0] });
          return dataStateActions.setActiveCollection({ activeCollection: coll });
        })
      );
    }),
  ));

  fetchEvents$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setEventTypeFilter),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        switchMap((slug) => this.dataSvc.fetchEvents(24, action.eventTypeFilter, slug)),
      );
    }),
    map((events) => dataStateActions.setEvents({ events })),
  ));

  setUserOpenBids$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.setMarketData),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectWalletAddress).pipe(
        map((address) => {
          return dataStateActions.setUserOpenBids({
            userOpenBids: action.marketData?.filter((item) => item.bid && item.bid?.fromAddress === address) || []
          });
        })
      );
    })
  ));

  fetchAll$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchAllPhunks),
    switchMap(() => this.dataSvc.getAttributes()),
    map((attributes) => {
      // console.log('attributes', attributes);
      return Object.keys(attributes).map((k) => {
        return {
          slug: 'ethereum-phunks',
          hashId: '',
          tokenId: Number(k),
          createdAt: new Date(),
          owner: '',
          prevOwner: '',

          attributes: (attributes as any)[k] as Attribute[],
        };
      });
    }),
    map((phunks) => dataStateActions.setAllPhunks({ allPhunks: phunks })),
  ));

  fetchOwned$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    switchMap((action) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        switchMap((slug) => this.dataSvc.fetchOwned(action.walletAddress, slug)),
      );
    }),
    map((phunks) => dataStateActions.setOwnedPhunks({ ownedPhunks: phunks })),
  ));

  fetchSingle$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchSinglePhunk),
    switchMap((action) => this.dataSvc.fetchSinglePhunk(action.phunkId)),
    map((phunk) => dataStateActions.setSinglePhunk({ phunk })),
  ));

  refreshSingle$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.refreshSinglePhunk),
    withLatestFrom(this.store.select(dataStateSelectors.selectSinglePhunk)),
    // tap(([action, phunk]) => console.log('refreshSinglePhunk', action, phunk)),
    filter(([action, phunk]) => !!phunk),
    map(([action, phunk]) => dataStateActions.fetchSinglePhunk({ phunkId: `${phunk!.hashId}` })),
  ));

  fetchTxHistory$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchTxHistory),
    filter((action) => !!action.hashId),
    switchMap((action) => this.dataSvc.fetchSingleTokenEvents(action.hashId)),
    map((txHistory) => dataStateActions.setTxHistory({ txHistory })),
  ));

  // fetchUserOpenBids$ = createEffect(() => this.actions$.pipe(
  //   ofType(dataStateActions.fetchUserOpenBids),
  //   switchMap(() => this.store.select(appStateSelectors.selectWalletAddress).pipe(
  //     filter((address) => !!address),
  //     switchMap((address) => this.store.select(dataStateSelectors.selectBids).pipe(
  //       // tap((phunks) => console.log('fetchUserOpenBids', phunks)),
  //       map((phunks) => phunks?.filter((phunk) => phunk.bid?.fromAddress === address) || []),
  //       // tap((phunks) => console.log('fetchUserOpenBids', phunks)),
  //     )),
  //   )),
  //   map((userOpenBids) => dataStateActions.setUserOpenBids({ userOpenBids })),
  // ));

  fetchLeaderboard$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchLeaderboard),
    switchMap(() => this.dataSvc.fetchLeaderboard()),
    map((leaderboard) => dataStateActions.setLeaderboard({ leaderboard })),
  ));

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private dataSvc: DataService,
    private web3Svc: Web3Service
  ) {}

  checkEventForPurchaseFromUser(event: Event, userAddress: string) {
    if (!userAddress) return;
    if (event.type === 'PhunkBought' && event.from.toLowerCase() === userAddress?.toLowerCase()) {
      // This phunk was bought FROM the active user.
      // We can notify them of this purchase
      this.store.dispatch(appStateActions.upsertNotification({
        notification: {
          id: event.blockTimestamp ? new Date(event.blockTimestamp).getTime() : Date.now(),
          type: 'event',
          function: 'purchased',
          hashId: event.hashId!,
          tokenId: event.tokenId,
          hash: event.txHash,
          isNotification: true,
          detail: event,
          value: Number(this.web3Svc.weiToEth(event.value)),
        }
      }));
    }
  }

  checkEventIsActiveSinglePhunk(event: Event, singlePhunk: Phunk | null) {
    if (!singlePhunk) return;
    if (event.hashId === singlePhunk.hashId) {
      this.store.dispatch(dataStateActions.refreshSinglePhunk());
      this.store.dispatch(dataStateActions.fetchTxHistory({ hashId: event.hashId }));
    }
  }
}
