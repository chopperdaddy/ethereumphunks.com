import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { EthService } from './services/eth.service';
import { StateService } from './services/state.service';
import { DataService } from './services/data.service';

import { EthscribeComponent } from './components/ethscribe/ethscribe.component';

import { Observable, from, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,

    EthscribeComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  ethPhunks$!: Observable<any[]>;

  constructor(
    public ethSvc: EthService,
    public stateSvc: StateService,
    private dataSvc: DataService
  ) {
    this.ethPhunks$ = this.stateSvc.walletAddress$.pipe(
      switchMap((address: string | null) => {
        if (!address) return of([]);
        return from(this.dataSvc.getUserEthPhunks(address));
      }),
      tap((res) => console.log(res))
    );
  }
}
