import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';

import { Phunk } from '@/models/db';
import { GlobalState } from '@/models/global-state';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { environment } from '@environments/environment';
import { selectUsd } from '@/state/data/data-state.selectors';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    WalletAddressDirective,

    WeiToEthPipe,
    FormatCashPipe,
  ],
  selector: 'app-item-status',
  templateUrl: './item-status.component.html',
  styleUrls: ['./item-status.component.scss'],
})
export class ItemStatusComponent {

  escrowAddress = environment.marketAddress;
  bridgeAddress = environment.bridgeAddress;

  phunk = input.required<Phunk>();

  usd$ = this.store.select(selectUsd);

  constructor(
    private store: Store<GlobalState>,
  ) {}
}
