import { Component } from '@angular/core';

import { CollectionsComponent } from '@/components/collections/collections.component';

@Component({
  selector: 'app-curated',
  standalone: true,
  imports: [
    CollectionsComponent
  ],
  templateUrl: './curated.component.html',
  styleUrl: './curated.component.scss'
})

export class CuratedComponent {

}
