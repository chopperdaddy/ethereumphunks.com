import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Web3Service } from '@/services/web3.service';
import { GlobalState, HistoryItem } from '@/models/global-state';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';
import { NgSelectModule } from '@ng-select/ng-select';
import { map, of, switchMap, tap, withLatestFrom } from 'rxjs';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})

export class SearchComponent {

  @ViewChild('searchInput') searchInput!: ElementRef;

  phunkBoxLoading: boolean = false;
  phunkBoxError: boolean = false;

  theme$ = this.store.select(appStateSelectors.selectTheme);
  phunkBox: FormGroup = new FormGroup({
    addressInput: new FormControl()
  });

  searchHistory$ = this.store.select(appStateSelectors.selectSearchHistory);
  historyActive$ = this.store.select(appStateSelectors.selectSearchHistoryActive);

  constructor(
    private store: Store<GlobalState>,
    private router: Router,
    private web3Svc: Web3Service
  ) {
    router.events.pipe(
      withLatestFrom(this.store.select(appStateSelectors.selectIsSearchResult)),
      tap(([$event, isSearchResult]) => {
        if ($event instanceof NavigationEnd) {
          console.log('NavigationEnd', {$event, isSearchResult});
          if (isSearchResult) {
            this.store.dispatch(appStateActions.setIsSearchResult({ isSearchResult: false }));
            this.phunkBox.reset();
          }
        }
      })
    ).subscribe();
  }

  @HostListener('document:keydown.escape', ['$event'])
  keydownHandler($event: KeyboardEvent) {
    // console.log('keydownHandler', $event);
    this.unfocusInput();
  }

  async onSubmit($event: any): Promise<void> {
    this.phunkBoxError = false;
    this.phunkBoxLoading = true;

    try {
      const addressInput  = this.phunkBox?.value?.addressInput?.toLowerCase();

      const is0x = addressInput?.startsWith('0x');
      const isEns = addressInput?.includes('.eth');
      const isAddress = is0x && this.web3Svc.verifyAddress(addressInput);
      const isTokenId = !is0x && Number(addressInput) > -1;
      const possibleHashId = is0x && addressInput.length === 66;

      if (!isEns && !isAddress && !isTokenId && !possibleHashId) throw new Error('Invalid Search Parameters');

      if (isTokenId) {
        await this.router.navigate(['/', 'details', addressInput]);
        this.phunkBoxLoading = false;
      } else {
        let address = addressInput;
        if (isEns) address = await this.web3Svc.getEnsOwner(addressInput);
        else address = this.web3Svc.verifyAddress(addressInput);

        if (address) await this.router.navigate(['/', 'market', 'owned'], { queryParams: { address }});
        else if (possibleHashId) await this.router.navigate(['/', 'details', addressInput]);
        else throw new Error('Invalid Search Parameters');
      }

      console.log({ isEns, isAddress, isTokenId, possibleHashId });
      let type = isEns ? 'ens' : isAddress ? 'address' : isTokenId ? 'tokenId' : possibleHashId ? 'hashId' : 'unknown';

      this.store.dispatch(appStateActions.addSearchHistory({ item: { type, value: addressInput } }));
      this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: false }));

      setTimeout(() => {
        this.store.dispatch(appStateActions.setIsSearchResult({ isSearchResult: true }));
      }, 200);
    } catch (error) {
      console.log(error);

      this.phunkBoxError = true;
      this.phunkBox.reset();
      setTimeout(() => this.phunkBoxError = false, 5000);
    } finally {
      this.phunkBoxLoading = false;
      this.unfocusInput();
    }
  }

  onFocus($event: any): void {
    console.log('onFocus', $event);
    this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: true }));
  }

  onBlur($event: any): void {
    // this.unfocusInput();
  }

  selectHistoryItem(item: any): void {
    console.log('selectHistoryItem', item);
    this.phunkBox.setValue({ addressInput: item });
    this.onSubmit(null);
  }

  removeHistoryItem(items: HistoryItem[], item: HistoryItem): void {
    console.log('removeHistoryItem', item);
    this.store.dispatch(appStateActions.removeSearchHistory({ index: items.indexOf(item) }));
  }

  clearSearchHistory(): void {
    console.log('removeAllHistory');
    this.store.dispatch(appStateActions.clearSearchHistory());
  }

  clearInput(): void {
    console.log('clearInput');
    this.phunkBox.reset();
    this.searchInput.nativeElement.focus();
  }

  unfocusInput(): void {
    this.searchInput.nativeElement.blur();
    this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: false }));
  }
}
