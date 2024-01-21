import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';

@Pipe({
  standalone: true,
  name: 'properties'
})

export class PropertiesPipe implements PipeTransform {

  transform(value: Phunk[], activeTraitFilters: TraitFilter | null): Phunk[] {

    // console.log({ value, activeTraitFilters });

    if (!value) return [];
    if (!activeTraitFilters) return value;

    const traitFilters: TraitFilter = { ...activeTraitFilters };
    delete traitFilters['address'];

    let filtered = value;
    const filtersLength = Object.keys(traitFilters).length;
    const traitCountFilter = traitFilters['trait-count'];

    if (traitCountFilter !== undefined) {
      const traitCount = Number(traitCountFilter);
      filtered = filtered.filter((res) => {
        return res.attributes && (res.attributes.length === traitCount + 2);
      });
    }

    if (filtersLength > 1 || (filtersLength === 1 && traitCountFilter === undefined)) {
      filtered = filtered.filter((res: Phunk) => {
        if (!res.attributes) return false;
        const matches = res.attributes.filter((attr) => {
          const key = attr?.k?.replace(/ /g, '-')?.toLowerCase();
          const val = attr?.v?.replace(/ /g, '-')?.toLowerCase();
          return traitFilters[key] === val;
        });
        return matches.length === filtersLength - (traitCountFilter !== undefined ? 1 : 0);
      });
    }

    return filtered;
  }
}
