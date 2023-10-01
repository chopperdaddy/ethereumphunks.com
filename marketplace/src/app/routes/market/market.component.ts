import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { DataService } from '@/services/data.service';
import { StateService } from '@/services/state.service';

import { BehaviorSubject } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { PhunkGridViewComponent } from '@/components/phunk-grid-view/phunk-grid-view.component';

import { Filters, Sorts } from '@/models/pipes';
import { Phunk } from '@/models/graph';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    PhunkGridViewComponent
  ],
  selector: 'app-market',
  templateUrl: './market.component.html',
  styleUrls: ['./market.component.scss'],
})

export class MarketComponent {

  private phunkData = new BehaviorSubject<Phunk[]>([]);
  phunkData$ = this.phunkData.asObservable();

  private marketType = new BehaviorSubject<Filters | null>(null);
  marketType$ = this.marketType.asObservable();

  activeSort: Sorts = 'price-low';

  constructor(
    public route: ActivatedRoute,
    private router: Router,
    public dataSvc: DataService,
    public stateSvc: StateService,
  ) {
    this.marketType$ = this.route.params.pipe(
      map((res: any) => res?.marketType)
    );

    this.phunkData$ = this.route.params.pipe(
      tap((res: any) => this.stateSvc.setMarketLoading(true)),
      map((res: any) => res?.marketType),
      // tap((res: any) => console.log('marketType', res)),
      switchMap((marketType: Filters) => {
        const params = this.route.snapshot.queryParams;

        if (marketType === 'bids') {
          this.activeSort = 'price-high';
        }

        if (marketType === 'owned') {
          const address = params.address?.toLowerCase();
          if (address) return this.dataSvc.fetchOwned(address);
          this.router.navigate(['/', 'listings']);
        }

        if (marketType === 'all') {
          this.activeSort = 'id';
          return this.dataSvc.getAllData();
        }

        return this.dataSvc.marketData$;
      }),
      // tap((res: Phunk[]) => console.log('Phunks', res.length)),
      tap(() => this.stateSvc.setMarketLoading(false))
    );
  }
}
