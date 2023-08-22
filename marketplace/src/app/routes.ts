import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./routes/index/index.component').then(mod => mod.IndexComponent),
  },
  {
    path: ':marketType',
    loadComponent: () => import('./routes/market/market.component').then(mod => mod.MarketComponent)
  },
  {
    path: 'details/:tokenId',
    loadComponent: () => import('./routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
  },
];
