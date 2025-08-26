import { Component } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { firstValueFrom } from 'rxjs';

import { MarketType } from '@/models/market.state';

import * as dataStateSelectors from '@/state/data/data-state.selectors';
import * as appStateSelectors from '@/state/app/app-state.selectors';
import * as appStateActions from '@/state/app/app-state.actions';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterModule,
  ],
  selector: 'app-collections-dropdown',
  templateUrl: './collections-dropdown.component.html',
  styleUrl: './collections-dropdown.component.scss'
})
export class CollectionsDropdownComponent {

  collections$ = this.store.select(dataStateSelectors.selectCollections);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);
  dropdownActive$ = this.store.select(appStateSelectors.selectCollectionsMenuActive);

  constructor(
    private store: Store<GlobalState>,
    public route: ActivatedRoute,
    public router: Router
  ) {}

  async toggleDropdown(): Promise<void> {
    const isActive = await firstValueFrom(
      this.store.select(appStateSelectors.selectCollectionsMenuActive)
    );
    this.store.dispatch(appStateActions.setCollectionsMenuActive({ collectionsMenuActive: !isActive }));
  }

  /**
   * Builds the target route for a collection while preserving child routes
   * @param newSlug - The slug of the collection to navigate to
   * @returns Promise resolving to boolean indicating navigation success
   */
  async buildCollectionRoute(newSlug: string): Promise<boolean> {
    const currentRoute = this.router.routerState.snapshot;
    const routeParams = currentRoute.root.children[0].params;
    const queryParams = currentRoute.root.queryParams;

    const marketType = routeParams['marketType'] as MarketType;
    if (marketType) {
      return this.router.navigate(['/', newSlug, 'market', marketType], {
        queryParams
      });
    }

    return this.router.navigate(['/', newSlug]);
  }
}
