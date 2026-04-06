import { isDevMode } from '@angular/core';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { TimeagoClock, TimeagoDefaultClock, TimeagoDefaultFormatter, TimeagoFormatter } from 'ngx-timeago';

import { routes } from '@/routes/routes';
import { CustomReuseStrategy } from '@/routes/route.strategy';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appStateReducer } from '@/state/app/app-state.reducers';
import { dataStateReducer } from '@/state/data/data-state.reducers';
import { marketStateReducer } from '@/state/market/market-state.reducers';
import { notificationReducer } from '@/state/notification/notification.reducers';
import { chatReducer } from '@/state/chat/chat.reducers';
import { modalReducer } from '@/state/modal/modal.reducers';
import { indexerLogsReducer } from '@/state/indexer-logs/indexer-logs.reducers';
import { adminAuthStateReducer } from '@/state/admin-auth/admin-auth-state.reducers';

import { AppStateEffects } from '@/state/app/app-state.effects';
import { DataStateEffects } from '@/state/data/data-state.effects';
import { MarketStateEffects } from '@/state/market/market-state.effects';
import { NotificationEffects } from '@/state/notification/notification.effects';
import { ChatEffects } from '@/state/chat/chat.effects';
import { IndexerLogsEffects } from '@/state/indexer-logs/indexer-logs.effects';
import { AdminAuthStateEffects } from '@/state/admin-auth/admin-auth-state.effects';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { MinMaxPipe } from '@/pipes/min-max';

export const config = {
  providers: [
    { provide: TimeagoFormatter, useClass: TimeagoDefaultFormatter },
    { provide: TimeagoClock, useClass: TimeagoDefaultClock },
    { provide: WeiToEthPipe, useClass: WeiToEthPipe },
    { provide: MinMaxPipe, useClass: MinMaxPipe },
    { provide: TokenIdParsePipe, useClass: TokenIdParsePipe },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },
    provideStore({
      appState: appStateReducer,
      adminAuthState: adminAuthStateReducer,
      dataState: dataStateReducer,
      marketState: marketStateReducer,
      notificationState: notificationReducer,
      chatState: chatReducer,
      modalState: modalReducer,
      indexerLogsState: indexerLogsReducer,
      router: routerReducer,
    }),
    provideEffects([
      AppStateEffects,
      DataStateEffects,
      MarketStateEffects,
      NotificationEffects,
      ChatEffects,
      IndexerLogsEffects,
      AdminAuthStateEffects
    ]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      trace: true,
      serialize: false
    }),
    provideRouterStore(),
    provideHttpClient(),
    provideRouter(
      routes,
      // withHashLocation(),
    ),
]
}
