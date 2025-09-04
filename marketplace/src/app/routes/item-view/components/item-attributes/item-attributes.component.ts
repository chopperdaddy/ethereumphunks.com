import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Phunk } from '@/models/db';

import { TraitRarityPipe } from '@/pipes/trait-rarity.pipe';
import { IsNumberPipe } from '@/pipes/is-number.pipe';
import { QueryParamsPipe } from '@/pipes/query-params.pipe';
import { ignoredTraitFilters } from '@/constants/collections';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    TraitRarityPipe,
    IsNumberPipe,
    QueryParamsPipe
  ],
  selector: 'app-item-attributes',
  templateUrl: './item-attributes.component.html',
  styleUrls: ['./item-attributes.component.scss']
})
export class ItemAttributesComponent {

  phunk = input.required<Phunk>();
  attributes = computed(() => {
    // console.log(this.phunk().attributes);
    // filter out attributes that are in ignoredTraitFilters
    return this.phunk().attributes?.filter(item => !ignoredTraitFilters[this.phunk().slug]?.includes(item.k));
    // return this.phunk().attributes;
  });

}
