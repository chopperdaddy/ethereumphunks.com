import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';

@Pipe({
  standalone: true,
  name: 'properties'
})

export class PropertiesPipe implements PipeTransform {

  transform(value: Phunk[], activeTraitFilters: TraitFilter | null, traitCount: number): Phunk[] {

    if (!value) return [];
    if (!activeTraitFilters) return value;

    if (traitCount || traitCount === 0) {
      value = value.filter((res) => {
        if (!res.attributes) return false;
        return (res.attributes?.length - 2) === traitCount;
      });
    }

    const filtersLength = Object.keys(activeTraitFilters).length;

    const filtered = value.filter((res: Phunk) => {
      const attrs = res.attributes;
      if (attrs) {
        const found = attrs.filter((attr) => {
          const key = attr?.k?.replace(/ /g, '-')?.toLowerCase();
          const val = attr?.v?.replace(/ /g, '-')?.toLowerCase();
          return activeTraitFilters[key] === val;
        });
        if (found.length === filtersLength) return true;
      }
      return false;
    });

    if (!filtered.length && !filtersLength) return value;
    return filtered;
  }
}
