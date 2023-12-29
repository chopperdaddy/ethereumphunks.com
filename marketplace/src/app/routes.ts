import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./routes/index/index.component').then(mod => mod.IndexComponent),
  },
  // {
  //   // create a redirect
  //   path: 'curated/ethereum-phunks/market/:marketType',
  //   redirectTo: '/market/:marketType',
  //   pathMatch: 'full',
  // },
  {
    path: 'market/:marketType',
    loadComponent: () => import('./routes/market/market.component').then(mod => mod.MarketComponent)
  },
  {
    path: 'details/:tokenId',
    loadComponent: () => import('./routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
  },
  {
    path: 'tests',
    loadComponent: () => import('./routes/tests/tests.component').then(mod => mod.TestsComponent)
  },
  {
    path: 'curated',
    loadComponent: () => import('./routes/curated/curated.component').then(mod => mod.CuratedComponent)
  },
  {
    path: 'curated/:slug',
    loadComponent: () => import('./routes/index/index.component').then(mod => mod.IndexComponent)
  },
  {
    path: 'curated/:slug/market/:marketType',
    loadComponent: () => import('./routes/market/market.component').then(mod => mod.MarketComponent)
  },
];
