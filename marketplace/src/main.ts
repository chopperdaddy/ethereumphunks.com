import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withHashLocation } from '@angular/router';

import { HttpClientModule } from '@angular/common/http';
// import { GraphQLModule } from './app/graphql.module';
import { TimeagoClock, TimeagoDefaultClock, TimeagoDefaultFormatter, TimeagoFormatter } from 'ngx-timeago';

import { AppComponent } from './app/app.component';

import { WeiToEthPipe } from './app/pipes/wei-to-eth.pipe';

import { routes } from './app/routes';
import { CustomReuseStrategy } from '@/routes/route.strategy';

import { DEFAULT_CONFIG } from 'ngforage';

import { environment } from './environments/environment';

import 'chartjs-adapter-moment';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { appStateReducer } from '@/state/reducers/app-state.reducer';
import { AppStateEffects } from '@/state/effects/app-state.effect';

if (environment.production) enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    { provide: TimeagoFormatter, useClass: TimeagoDefaultFormatter },
    { provide: TimeagoClock, useClass: TimeagoDefaultClock },
    { provide: WeiToEthPipe, useClass: WeiToEthPipe },
    { provide: DEFAULT_CONFIG, useValue: { name: 'cryptophunksCE' } },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },

    provideStore({
      appState: appStateReducer,
    }),
    provideEffects([
      AppStateEffects,
    ]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      trace: true,
    }),

    importProvidersFrom(
      HttpClientModule,
      // GraphQLModule
    ),
    provideRouter(routes, withHashLocation())
  ]
});
