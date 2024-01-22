import { Pipe, PipeTransform } from '@angular/core';

import { formatEther } from 'viem';

import { Calcs } from '@/models/pipes';
import { Phunk } from '@/models/db';

@Pipe({
  standalone: true,
  name: 'calc'
})

export class CalcPipe implements PipeTransform {

  transform(value: Phunk[] | any[], type: Calcs): number {

    // console.log(value, type)
    if (!value?.length) return 0;
    if (!type) return 0;
    // console.log(value)

    if (type === 'lowestListingPrice') {
      let val = Math.min(...value.map((item) => Number(formatEther(BigInt(item.listing!.minValue!)))));
      return val;
    }

    if (type === 'averageBidPrice') {
      let val = value.reduce((sum, obj) => sum + Number(formatEther(BigInt(obj.bid!.value!))), 0) / value.length;
      return val;
    }

    if (type === 'averageYearBidPrice') {
      let val = value.filter((res, i) => i < 366).reduce((sum, obj) => sum + Number(formatEther(BigInt(obj.bid!.value!))), 0) / value.length;
      return val;
    }

    if (type === 'totalBidsValue') {
      let val = value.reduce((sum, obj) => sum + Number(formatEther(BigInt(obj.bid!.value!))), 0);
      return val;
    }

    if (type === 'totalListingsValue') {
      let val = value.reduce((sum, obj) => sum + Number(formatEther(BigInt(obj.listing!.minValue!))), 0);
      return val;
    }

    return 0;
  }
}
