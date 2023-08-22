import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PunkGridViewComponent } from '@/components/punk-grid-view/punk-grid-view.component';
import { TxOverviewComponent } from '@/components/overview/overview.component';
import { SplashComponent } from '@/components/splash/splash.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { StateService } from '@/services/state.service';
import { ThemeService } from '@/services/theme.service';

import { FilterPipe } from '@/pipes/filter.pipe';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { CountPipe } from '@/pipes/count.pipe';
import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { Punk } from '@/models/graph';

import { Observable } from 'rxjs';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    LazyLoadImageModule,

    SplashComponent,
    PunkGridViewComponent,
    TxOverviewComponent,

    WeiToEthPipe,
    FilterPipe,
    CalcPipe,
    CountPipe,
    TokenIdParsePipe
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent implements OnInit {

  allData$!: Observable<Punk[]>;

  punkBoxLoading: boolean = false;
  punkBoxError: boolean = false;

  punkBox: FormGroup = new FormGroup({
    addressInput: new FormControl()
  });

  randomPunks: string[] = [ '7209', ...Array.from({length: 9}, () => `${Math.floor(Math.random() * 10000)}`)];

  constructor(
    public themeSvc: ThemeService,
    public stateSvc: StateService,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    private router: Router
  ) {
    this.allData$ = this.dataSvc.getAllData();
  }

  ngOnInit(): void {}

  async onSubmit($event: any): Promise<void> {
    try {
      this.punkBoxLoading = true;

      const addressInput  = this.punkBox?.value?.addressInput;
      let address = addressInput;

      const isEns = addressInput?.includes('.eth');
      const isAddress = this.web3Svc.verifyAddress(addressInput);
      const isTokenId = Number(addressInput) < 10000 && Number(addressInput) > 0;

      if (!isEns && !isAddress && !isTokenId) throw new Error('Invalid Address');

      if (isTokenId) {
        this.router.navigate(['/', 'details', addressInput]);
        this.punkBoxLoading = false;
        return;
      }

      if (isEns) address = await this.web3Svc.getEnsOwner(addressInput);
      else address = this.web3Svc.verifyAddress(addressInput);

      if (address) this.router.navigate(['/', 'owned'], { queryParams: { address }});
      else throw new Error('Invalid Address');

      this.punkBoxLoading = false;

    } catch (error) {
      console.log(error);
      this.punkBoxLoading = false;
      this.punkBoxError = true;
    }
  }

}
