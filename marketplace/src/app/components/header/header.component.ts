import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';

import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { StateService } from '@/services/state.service';

import { Subject, firstValueFrom, tap, withLatestFrom } from 'rxjs';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { GlobalState } from '@/models/global-state';
import { selectConnected, selectHasWithdrawal, selectWalletAddress } from '@/state/selectors/app-state.selector';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    WalletAddressDirective,

    FormatCashPipe,
  ],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})

export class HeaderComponent implements OnInit {

  connected$ = this.store.select(selectConnected);
  walletAddress$ = this.store.select(selectWalletAddress);
  hasWithdrawal$ = this.store.select(selectHasWithdrawal);

  connect$ = new Subject<void>();

  constructor(
    private store: Store<GlobalState>,
    public web3Svc: Web3Service,
    public stateSvc: StateService,
    public themeSvc: ThemeService
  ) {
    this.connect$.pipe(
      withLatestFrom(this.connected$),
      tap(([_, connected]) => {
        if (!connected) return this.web3Svc.connect();
        return this.web3Svc.disconnectWeb3();
      }),
    ).subscribe();
  }

  ngOnInit(): void {}

  async switchTheme(): Promise<void> {
    const theme = await firstValueFrom(this.themeSvc.theme$);
    this.themeSvc.setTheme(theme === 'dark' ? 'light' : 'dark');
  }

}
