import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { StateService } from '@/services/state.service';
import { DataService } from '@/services/data.service';

import { switchMap, from, of, Observable, map } from 'rxjs';

@Component({
  selector: 'app-owned',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './owned.component.html',
  styleUrls: ['./owned.component.scss']
})
export class OwnedComponent {

  @Output() phunkSelected: EventEmitter<string> = new EventEmitter<string>();

  ethPhunks$!: Observable<any[] | null>;

  expanded = false;

  constructor(
    private stateSvc: StateService,
    private dataSvc: DataService
  ) {
    this.ethPhunks$ = this.stateSvc.walletAddress$.pipe(
      switchMap((address: string | null) => {
        if (!address) return of([]);
        return from(this.dataSvc.getUserEthPhunks(address));
      }),
      map((phunks: any[]) => {
        if (!phunks.length) return null;
        return phunks;
      })
    );
  }

  setPhunkSelected(phunkId: string) {
    this.phunkSelected.emit(phunkId);
  }

}
