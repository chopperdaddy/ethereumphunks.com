import { Pipe, PipeTransform } from '@angular/core';
import { formatEther } from 'viem';

@Pipe({
  standalone: true,
  name: 'weiToEth'
})

export class WeiToEthPipe implements PipeTransform {

  transform(value: string | null): number {
    if (!value) return 0;
    const eth = formatEther(BigInt(value));
    if (Number(eth) > 100000000000) return 100000000000;
    return Number(eth);
  }

}
