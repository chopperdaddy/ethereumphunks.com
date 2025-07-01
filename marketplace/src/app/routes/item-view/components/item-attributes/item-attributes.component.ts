import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Phunk } from '@/models/db';

import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { IsNumberPipe } from '@/pipes/is-number.pipe';
import { QueryParamsPipe } from '@/pipes/query-params.pipe';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    TraitCountPipe,
    IsNumberPipe,
    QueryParamsPipe
  ],
  selector: 'app-item-attributes',
  templateUrl: './item-attributes.component.html',
  styleUrls: ['./item-attributes.component.scss']
})
export class ItemAttributesComponent {

  phunk = input.required<Phunk>();

}
