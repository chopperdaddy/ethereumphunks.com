import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withHashLocation } from '@angular/router';

import { HttpClientModule } from '@angular/common/http';

import { TimeagoClock, TimeagoDefaultClock, TimeagoDefaultFormatter, TimeagoFormatter } from 'ngx-timeago';

import { AppComponent } from './app/app.component';

import { WeiToEthPipe } from './app/pipes/wei-to-eth.pipe';

import { routes } from './app/routes';
import { CustomReuseStrategy } from '@/routes/route.strategy';

import { DEFAULT_CONFIG } from 'ngforage';

import { environment } from './environments/environment';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appStateReducer } from '@/state/reducers/app-state.reducers';
import { dataStateReducer } from '@/state/reducers/data-state.reducers';

import { AppStateEffects } from '@/state/effects/app-state.effects';
import { DataStateEffects } from '@/state/effects/data-state.effects';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';
// import { provideServiceWorker } from '@angular/service-worker';

if (environment.production) enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    { provide: TimeagoFormatter, useClass: TimeagoDefaultFormatter },
    { provide: TimeagoClock, useClass: TimeagoDefaultClock },
    { provide: WeiToEthPipe, useClass: WeiToEthPipe },
    { provide: TokenIdParsePipe, useClass: TokenIdParsePipe },
    { provide: DEFAULT_CONFIG, useValue: { name: 'etherphunks' } },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },
    provideStore({
        appState: appStateReducer,
        dataState: dataStateReducer,
        router: routerReducer
    }),
    provideEffects([
        AppStateEffects,
        DataStateEffects
    ]),
    provideStoreDevtools({
        maxAge: 25,
        logOnly: !isDevMode(),
        trace: true,
        // serialize: false
    }),
    provideRouterStore(),
    importProvidersFrom(HttpClientModule),
    provideRouter(
      routes,
      withHashLocation(),
      // withInMemoryScrolling({
      //   scrollPositionRestoration: 'top',
      // }),
    ),
    // provideServiceWorker('ngsw-worker.js', {
    //     enabled: !isDevMode(),
    //     registrationStrategy: 'registerWhenStable:30000'
    // })
]
});
