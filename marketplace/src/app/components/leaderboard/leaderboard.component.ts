import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DataService } from '@/services/data.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    WalletAddressDirective
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss'
})
export class LeaderboardComponent {

  leaderboard$ = this.dataSvc.fetchLeaderboard();

  constructor(
    private dataSvc: DataService
  ) {}

}
