import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'count'
})

export class CountPipe implements PipeTransform {

  transform(value: Array<any>, ...args: any | null): number {
    if (!value?.length) return 0;
    if (!args) return 0;

    const type = args[0];
    if (type === 'listings') return value.filter((item: any) => !!item.listing).length;
    if (type === 'bids') return value.filter((item: any) => !!item.bid).length;
    return value.length;
  }
}
