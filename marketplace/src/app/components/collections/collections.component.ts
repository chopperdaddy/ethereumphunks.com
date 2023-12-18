import { Component } from '@angular/core';

import { DataService } from '@/services/data.service';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { map, tap } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterLink
  ],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss'
})
export class CollectionsComponent {

  collections$ = this.dataSvc.fetchCollections().pipe(
    tap(collections => console.log(collections)),
  );

  constructor(
    private dataSvc: DataService
  ) {}

}
