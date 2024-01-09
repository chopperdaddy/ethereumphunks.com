import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Web3Service } from '@/services/web3.service';
import { GlobalState } from '@/models/global-state';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})

export class SearchComponent {

  phunkBoxLoading: boolean = false;
  phunkBoxError: boolean = false;

  phunkBox: FormGroup = new FormGroup({
    addressInput: new FormControl()
  });

  theme$ = this.store.select(appStateSelectors.selectTheme);

  constructor(
    private store: Store<GlobalState>,
    private router: Router,
    private web3Svc: Web3Service
  ) {

    router.events.subscribe((val) => {
      this.phunkBox.reset();
    });

  }

  async onSubmit($event: any): Promise<void> {
    try {

      this.phunkBoxError = false;
      this.phunkBoxLoading = true;

      const addressInput  = this.phunkBox?.value?.addressInput?.toLowerCase();

      const is0x = addressInput?.startsWith('0x');
      const isEns = addressInput?.includes('.eth');
      const isAddress = is0x && this.web3Svc.verifyAddress(addressInput);
      const isTokenId = !is0x && Number(addressInput) > -1;
      const possibleHashId = is0x && addressInput.length === 66;

      console.log({ isEns, isAddress, isTokenId, possibleHashId });

      if (!isEns && !isAddress && !isTokenId && !possibleHashId) throw new Error('Invalid Search Parameters');

      if (isTokenId) {
        this.router.navigate(['/', 'details', addressInput]);
        this.phunkBoxLoading = false;
        return;
      }

      let address = addressInput;
      if (isEns) address = await this.web3Svc.getEnsOwner(addressInput);
      else address = this.web3Svc.verifyAddress(addressInput);

      if (address) this.router.navigate(['/', 'market', 'owned'], { queryParams: { address }});
      else if (possibleHashId) this.router.navigate(['/', 'details', addressInput]);
      else throw new Error('Invalid Search Parameters');

      this.phunkBoxLoading = false;
      this.phunkBox.reset();
    } catch (error) {
      console.log(error);

      this.phunkBoxLoading = false;
      this.phunkBoxError = true;
      setTimeout(() => this.phunkBoxError = false, 3000);
      this.phunkBox.reset();
    }
  }
}
