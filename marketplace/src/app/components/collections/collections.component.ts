import { Component } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Store } from '@ngrx/store';
import { GlobalState } from '@/models/global-state';

import { DataService } from '@/services/data.service';
import { SortOption } from '@/models/sorts.model';

import { PhunkGridComponent } from '../phunk-grid/phunk-grid.component';
import { selectCollections } from '@/state/data/data-state.selectors';
import { filter, map } from 'rxjs';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterLink,

    PhunkGridComponent
  ],
  selector: 'app-collections',
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss'
})
export class CollectionsComponent {

  collections$ = this.store.select(selectCollections).pipe(
    filter(collections => !!collections),
    map(collections => {
      // remove first item in array
      return collections.slice(1);
    })
  )

  SortOption = SortOption;

  constructor(
    private dataSvc: DataService,
    private store: Store<GlobalState>
  ) {

  }

}
