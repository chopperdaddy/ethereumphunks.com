import { Pipe, PipeTransform } from '@angular/core';
import { formatEther } from 'viem';

@Pipe({
  standalone: true,
  name: 'weiToEth'
})

export class WeiToEthPipe implements PipeTransform {

  transform(value: string | number | null): number {
    if (typeof value === 'number') value = `${value}`;
    if (!value) return 0;
    const eth = formatEther(BigInt(value));
    // console.log('eth', Number(eth), eth);
    if (Number(eth) > 100000000000) return 100000000000;
    // if (eth.length > 8) return Number(eth.slice(0, 7));
    return Number(eth);
  }

}
