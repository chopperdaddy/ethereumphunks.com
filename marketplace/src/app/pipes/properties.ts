import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/graph';

@Pipe({
  standalone: true,
  name: 'properties'
})

export class PropertiesPipe implements PipeTransform {

  transform(value: Phunk[], ...args: any[]): Phunk[] {

    if (args[0]['address']) delete args[0]['address'];

    if (!value?.length) return [];
    if (!args?.length) return value;

    const traitCount = args[1];
    if (traitCount || traitCount === 0) {
      value = value.filter((res) => (res.attributes?.length - 2) === traitCount);
    }

    const filtersLength = Object.keys(args[0]).length;

    const filtered = value.filter((res: Phunk) => {
      const attrs = res.attributes;
      if (attrs) {
        const found = attrs.filter((attr) => {
          const key = attr?.k?.replace(/ /g, '-')?.toLowerCase();
          const val = attr?.v?.replace(/ /g, '-')?.toLowerCase();
          return args[0][key] === val;
        });
        if (found.length === filtersLength) return true;
      }
      return false;
    });

    if (!filtered.length && !filtersLength) return value;
    return filtered;
  }
}
