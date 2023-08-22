import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { StateService } from '@/services/state.service';

import { firstValueFrom } from 'rxjs';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

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

  cigMenuOpen = false;

  constructor(
    public web3Svc: Web3Service,
    public stateSvc: StateService,
    public themeSvc: ThemeService
  ) {}

  ngOnInit(): void {}

  async switchTheme(): Promise<void> {
    const theme = await firstValueFrom(this.themeSvc.theme$);
    this.themeSvc.setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  connect(): void {
    if (this.stateSvc.getWeb3Connected()) this.web3Svc.disconnectWeb3();
    else this.web3Svc.connect();
  }

}
