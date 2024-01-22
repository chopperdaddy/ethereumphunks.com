import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [ CommonModule, WalletAddressDirective],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})

export class FooterComponent implements OnInit {

  explorerUrl = environment.explorerUrl;
  contract = environment.marketAddress;
  points = environment.pointsAddress;
  contributions = environment.donationsAddress;

  constructor() { }

  ngOnInit(): void {
  }
}
