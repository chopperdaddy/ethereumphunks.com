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

import { asyncScheduler, catchError, filter, from, map, mergeMap, of, switchMap, tap, throttleTime, withLatestFrom } from 'rxjs';

import { Web3Service } from '@/services/web3.service';

@Injectable()
export class DataStateEffects {

  // When the database is updated
  dbEventTriggered$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.dbEventTriggered),
    withLatestFrom(
      this.store.select(dataStateSelectors.selectSinglePhunk),
      this.store.select(appStateSelectors.selectWalletAddress)
    ),
    map(([action, singlePhunk, address]) => {
      // Check if the event is for the active phunk
      const newEvent = action.payload.new as Event;
      this.checkEventIsActiveSinglePhunk(newEvent, singlePhunk);
      this.checkEventForPurchaseFromUser(newEvent, address);
      return newEvent;
    }),
    // Start with the throttle
    throttleTime(3000, asyncScheduler, {
      leading: true, // emit the first value immediately
      trailing: true // emit the last value in the window
    }),
    map((event) => dataStateActions.triggerDataRefresh()),
  ));

  onBlockNumber$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setCurrentBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    switchMap(([action, address]) => {
      const currentBlock = action.currentBlock;
      const storedBlock = localStorage.getItem('EtherPhunks_currentBlock');
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
    withLatestFrom(this.store.select(appStateSelectors.selectCurrentBlock)),
    tap(([_, blockNumber]) => localStorage.setItem('EtherPhunks_currentBlock', JSON.stringify(blockNumber))),
  ), { dispatch: false });

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
    ofType(
      appStateActions.setEventTypeFilter,
      dataStateActions.triggerDataRefresh
    ),
    withLatestFrom(this.store.select(appStateSelectors.selectEventTypeFilter)),
    switchMap(([_, eventTypeFilter]) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        switchMap((slug) => this.dataSvc.fetchEvents(24, eventTypeFilter, slug)),
      );
    }),
    map((events) => dataStateActions.setEvents({ events })),
  ));

  fetchMarketData$ = createEffect(() => this.actions$.pipe(
    ofType(
      dataStateActions.fetchMarketData,
      dataStateActions.triggerDataRefresh
    ),
    switchMap(() => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        filter((slug) => !!slug),
        switchMap((slug) => this.dataSvc.fetchMarketData(slug)),
      )
    }),
    map((marketData) => dataStateActions.setMarketData({ marketData }))
  ));

  fetchAll$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.setMarketData),
    withLatestFrom(this.store.select(appStateSelectors.selectMarketSlug)),
    switchMap(([action, marketSlug]) => {
      return from(this.dataSvc.fetchAll(marketSlug, 0, 250)).pipe(
        switchMap((all) => {
          return this.dataSvc.getAttributes(marketSlug).pipe(
            map((attributes) => {
              return all.map((phunk) => ({
                ...phunk,
                attributes: attributes[phunk.sha]
              }));
            })
          )
        }),
      )
    }),
    map((phunks: any) => dataStateActions.setAllPhunks({ allPhunks: phunks }))
  ));

  paginateAll$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.paginateAll),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMarketSlug),
      this.store.select(appStateSelectors.selectMarketType),
      this.store.select(dataStateSelectors.selectAllPhunks),
    ),
    filter(([action, marketSlug, marketType, all]) => marketType === 'all'),
    tap(([action, marketSlug, marketType, all]) => {
      console.log({ action, marketSlug, marketType, all });
    }),
    switchMap(([action, marketSlug, marketType, all]) => {
      return from(this.dataSvc.fetchAll(marketSlug, all?.length || 0, action.limit)).pipe(
        switchMap((newPhunks) => {
          return this.dataSvc.getAttributes(marketSlug).pipe(
            map((attributes) => {
              return newPhunks.map((phunk) => ({
                ...phunk,
                attributes: attributes[phunk.sha]
              }));
            })
          )
        }),
        map((newPhunks: any) => dataStateActions.setAllPhunks({ allPhunks: [...(all || []), ...newPhunks] }))
      )
    }),
  ));

  fetchOwned$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.setWalletAddress,
      dataStateActions.triggerDataRefresh
    ),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    switchMap(([_, address]) => {
      return this.store.select(appStateSelectors.selectMarketSlug).pipe(
        switchMap((slug) => this.dataSvc.fetchOwned(address, slug)),
      );
    }),
    map((phunks) => dataStateActions.setOwnedPhunks({ ownedPhunks: phunks })),
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

  fetchSingle$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.fetchSinglePhunk),
    switchMap((action) => this.dataSvc.fetchSinglePhunk(action.phunkId)),
    mergeMap((phunk) => [
      dataStateActions.setSinglePhunk({ phunk }),
      appStateActions.setMarketSlug({ marketSlug: phunk.slug }),
    ]),
  ));

  refreshSingle$ = createEffect(() => this.actions$.pipe(
    ofType(dataStateActions.refreshSinglePhunk),
    withLatestFrom(this.store.select(dataStateSelectors.selectSinglePhunk)),
    filter(([action, phunk]) => !!phunk),
    map(([action, phunk]) => dataStateActions.fetchSinglePhunk({ phunkId: `${phunk!.hashId}` })),
  ));

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
    }
  }
}
