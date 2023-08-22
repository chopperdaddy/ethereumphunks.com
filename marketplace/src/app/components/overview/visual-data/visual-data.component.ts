import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

import { DataService } from '@/services/data.service';
import { StateService } from '@/services/state.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { State } from '@/models/graph';

import { switchMap, tap } from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'app-visual-data',
  imports: [
    CommonModule,
    NgSelectModule,
    FormsModule,

    WeiToEthPipe,
    FormatCashPipe
  ],
  templateUrl: './visual-data.component.html',
  styleUrls: ['./visual-data.component.scss']
})

export class VisualDataComponent {

  @Input() statesData!: State[];

  statsData: any = { sales: 0, volume: 0 };

  isSafari = false ?? /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  constructor(
    public dataSvc: DataService,
    public stateSvc: StateService,
  ) {
    stateSvc.activePeriod$.pipe(
      switchMap(() => this.dataSvc.statesData$),
      tap((res: State[]) => {

        const n = this.stateSvc.getActivePeriod()?.limit || 0;
        const firstNEntries = res.slice(0, n);

        if (res?.length) {

          // console.log()
          this.statsData = {
            floor: res[0].floor,
            owners: Number(firstNEntries[0].owners),
            newOwners: (Number(firstNEntries[0].owners) || 0) - (Number(firstNEntries[firstNEntries.length - 1].owners) || 0),
            sales: firstNEntries.reduce((a, b) => Number(a) + Number(b.sales), 0),
            volume: firstNEntries.reduce((a, b) => BigInt(a) + BigInt(b.volume), BigInt(0))
          };
        }
      }),
      // tap(() => console.log(this.statsData))
    ).subscribe();
  }

  setAcivePeriod(period: any): void {
    // console.log(period);
    this.stateSvc.setActivePeriod(period);
  }

}
