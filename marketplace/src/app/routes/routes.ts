import { Routes } from '@angular/router';

import { InitialCollectionGuard } from '@/guards/initial-collection.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [InitialCollectionGuard],
    component: InitialCollectionGuard
  },
  {
    path: 'admin',
    loadComponent: () => import('@/routes/admin-dashboard/admin-dashboard.component').then(mod => mod.AdminDashboardComponent)
  },
  {
    path: 'market/:marketType',
    redirectTo: 'ethereum-phunks/market/:marketType',
    pathMatch: 'full'
  },
  {
    path: 'curated/:slug',
    redirectTo: ':slug',
    pathMatch: 'full'
  },
  {
    path: 'curated/:slug/market/:marketType',
    redirectTo: ':slug/market/:marketType',
    pathMatch: 'full'
  },
  {
    path: 'details/:hashId',
    loadComponent: () => import('@/routes/item-view/item-view.component').then(mod => mod.ItemViewComponent)
  },
  {
    matcher: (segments) => {
      if (segments.length === 1 && segments[0].path !== 'admin') {
        return { consumed: segments, posParams: { slug: segments[0] } };
      }
      return null;
    },
    loadComponent: () => import('@/routes/index/index.component').then(mod => mod.IndexComponent)
  },
  {
    path: ':slug/market/:marketType',
    loadComponent: () => import('@/routes/market/market.component').then(mod => mod.MarketComponent)
  },
  {
    path: '**',
    redirectTo: '/',
  }
];
