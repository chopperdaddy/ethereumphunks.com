import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Collection } from '@/models/data.state';

@Component({
  standalone: true,
  imports: [
    CommonModule,
  ],
  selector: 'app-collection-info',
  templateUrl: './collection-info.component.html',
  styleUrls: ['./collection-info.component.scss']
})
export class CollectionInfoComponent {

  collection = input<Collection | null>();

}
