import { Pipe, PipeTransform } from '@angular/core';

import { traits } from '@/constants/traits';

@Pipe({
  standalone: true,
  name: 'traitCount'
})

export class TraitCountPipe implements PipeTransform {

  transform(value: string, slug: string): string {
    console.log(slug)
    return traits[slug][value];
  }
}
