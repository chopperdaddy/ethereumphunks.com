import { Component } from '@angular/core';

import { DataService } from '@/services/data.service';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { map, tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { PhunkGridComponent } from '../shared/phunk-grid/phunk-grid.component';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterLink,

    PhunkGridComponent
  ],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss'
})
export class CollectionsComponent {

  collections$ = this.dataSvc.fetchCollectionsWithAssets().pipe(
    map(collections => collections.filter((collection, i) => i !== 0)),
    // tap(collections => console.log(collections)),
  );

  constructor(
    private dataSvc: DataService
  ) {}

}
