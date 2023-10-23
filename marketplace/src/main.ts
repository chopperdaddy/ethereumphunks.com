import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
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
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { appStateReducer } from '@/state/reducers/app-state.reducer';
import { AppStateEffects } from '@/state/effects/app-state.effect';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

if (environment.production) enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    { provide: TimeagoFormatter, useClass: TimeagoDefaultFormatter },
    { provide: TimeagoClock, useClass: TimeagoDefaultClock },
    { provide: WeiToEthPipe, useClass: WeiToEthPipe },
    { provide: TokenIdParsePipe, useClass: TokenIdParsePipe },
    { provide: DEFAULT_CONFIG, useValue: { name: 'cryptophunksCE' } },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },

    provideStore({
      appState: appStateReducer,
      router: routerReducer
    }),
    provideEffects([
      AppStateEffects,
    ]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      trace: true,
    }),

    provideAnimations(),
    provideRouterStore(),

    importProvidersFrom(
      HttpClientModule
    ),
    provideRouter(routes, withHashLocation())
  ]
});
