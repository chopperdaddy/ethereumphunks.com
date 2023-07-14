import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { EthService } from './services/eth.service';
import { StateService } from './services/state.service';

import { EthscribeComponent } from './components/ethscribe/ethscribe.component';
import { OwnedComponent } from './components/owned/owned.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,

    EthscribeComponent,
    OwnedComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {
  constructor(
    public ethSvc: EthService,
    public stateSvc: StateService,
  ) {}
}
