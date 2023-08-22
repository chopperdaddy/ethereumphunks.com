import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withHashLocation } from '@angular/router';

import { HttpClientModule } from '@angular/common/http';
import { GraphQLModule } from './app/graphql.module';
import { TimeagoClock, TimeagoDefaultClock, TimeagoDefaultFormatter, TimeagoFormatter } from 'ngx-timeago';

import { AppComponent } from './app/app.component';

import { WeiToEthPipe } from './app/pipes/wei-to-eth.pipe';

import { routes } from './app/routes';
import { CustomReuseStrategy } from '@/routes/route.strategy';

import { DEFAULT_CONFIG } from 'ngforage';

import { environment } from './environments/environment';

import 'chartjs-adapter-moment';

if (environment.production) enableProdMode();

bootstrapApplication(AppComponent, {
  providers: [
    { provide: TimeagoFormatter, useClass: TimeagoDefaultFormatter },
    { provide: TimeagoClock, useClass: TimeagoDefaultClock },
    { provide: WeiToEthPipe, useClass: WeiToEthPipe },
    { provide: DEFAULT_CONFIG, useValue: { name: 'cryptopunksCE' } },
    { provide: RouteReuseStrategy, useClass: CustomReuseStrategy },
    
    importProvidersFrom(HttpClientModule, GraphQLModule),
    provideRouter(routes, withHashLocation())
  ]
});
