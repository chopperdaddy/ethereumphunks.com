import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { IntersectionObserverModule } from '@ng-web-apis/intersection-observer';

import { GlobalState } from '@/models/global-state';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';

import * as selectors from '@/state/selectors/app-state.selector';
import * as actions from '@/state/actions/app-state.action';

import anime from 'animejs';

import { tap } from 'rxjs';
import { Phunk } from '@/models/graph';
import { Web3Service } from '@/services/web3.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    IntersectionObserverModule,

    RouterModule,
    PhunkGridComponent
  ],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements AfterViewInit {

  @ViewChild('menuInner') menuInner!: ElementRef;

  stats: any = {
    owned: 0,
    escrowed: 0,
    listed: 0,
  };

  address$ = this.store.select(selectors.selectWalletAddress);
  menuActive$ = this.store.select(selectors.selectMenuActive);
  ownedPhunks$ = this.store.select(selectors.selectOwnedPhunks).pipe(
    tap((owned: Phunk[] | null) => {

      // Get all the attributes
      const allTraits = owned?.map((phunk: Phunk) => phunk.attributes);
      const traits = allTraits?.reduce((acc: any, val: any) => acc.concat(val), []);

      // Count the occurrences of each attribute
      const traitCounts = traits?.reduce((acc: {[key: string]: number}, trait: {k: string, v: string}) => {
        const key = `${trait.k}:${trait.v}`; // creates a unique key from the k:v pair
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const males = traitCounts?.['Sex:Male'] || 0;
      const females = traitCounts?.['Sex:Female'] || 0;

      console.log(`Males: ${males}, Females: ${females}`);

      // Remove the counts for "Male" and "Female" to get rare traits excluding "Sex"
      delete traitCounts?.['Sex:Male'];
      delete traitCounts?.['Sex:Female'];

      // Convert the frequency object to a sorted array of [key, count] pairs
      const sortedTraits = traitCounts ? Object.entries(traitCounts).sort((a: any, b: any) => a[1] - b[1]) : []; // Note: We sort in ascending order now to get the rarest

      // Get the top 3 most rare traits
      const top3RarestTraits = sortedTraits.slice(0, 3);

      console.log(top3RarestTraits);

      const escrowed = owned?.filter((phunk: Phunk) => phunk.isEscrowed)?.length;
      const listed = owned?.filter((phunk: Phunk) => phunk.listing)?.length;
      this.stats = {
        owned: owned?.length,
        escrowed,
        listed,
      };
    })
  );

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private el: ElementRef,
  ) {
    el.nativeElement.style.transform = 'translateY(-100%)';
  }

  ngAfterViewInit(): void {
    this.menuActive$.pipe(
      tap((active: boolean) => {
        anime.timeline({
          easing: 'cubicBezier(0.785, 0.135, 0.15, 0.86)',
          duration: 400,
        }).add({
          targets: this.el?.nativeElement,
          translateY: active ? '0%' : '-100%',
        }).add({
          targets: this.menuInner?.nativeElement,
          opacity: active ? 1 : 0,
        });
      })
    ).subscribe();
  }

  async disconnect(): Promise<void> {
    await this.web3Svc.disconnectWeb3();
    this.store.dispatch(actions.setMenuActive({ menuActive: false }));
  }

  async withdraw(): Promise<void> {
    await this.web3Svc.withdraw();
  }

}
