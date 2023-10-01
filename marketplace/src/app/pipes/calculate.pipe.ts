import { Pipe, PipeTransform } from '@angular/core';

import { formatEther } from 'viem';

import { Calcs } from '@/models/pipes';
import { Phunk } from '@/models/graph';

@Pipe({
  standalone: true,
  name: 'calc'
})

export class CalcPipe implements PipeTransform {

  transform(value: Phunk[], type: Calcs): number {

    if (!value?.length) return 0;
    if (!type) return 0;

    if (type === 'lowestListingPrice') {
      let val = Math.min(...value.map((item) => Number(formatEther(BigInt(item.listing!.value!)))));
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
      // console.log(value)
      let val = value.reduce((sum, obj) => sum + Number(formatEther(BigInt(obj.bid!.value!))), 0);

      let v = 0;
      value.sort((a, b) => Number(formatEther(BigInt(b.bid!.value))) - Number(formatEther(BigInt(a.bid!.value)))).map((res) => {
        v = v + Number(formatEther(BigInt(res.bid!.value)))
        // console.log(v, Number(formatEther(BigInt(res.bid!.value))))
      });

      // console.log('val', v)
      return val;
    }

    return 0;
  }
}
