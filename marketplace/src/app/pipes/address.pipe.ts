import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '@environments/environment';

import { Web3Service } from '@/services/web3.service';

@Pipe({
  name: 'address',
  standalone: true
})
export class AddressPipe implements PipeTransform {

  constructor(
    private web3Svc: Web3Service
  ) {}

  transform(address: string, ens: boolean = true): Promise<string | null> {
    return this.setAddress(address, ens);
  }

  async setAddress(address: string, ens: boolean): Promise<string | null> {
    if (!address) return null;

    if (address === environment.agent.address) {
      return environment.agent.name;
    }

    let text = address.slice(0, 5) + '...' + address.slice(-5);

    if (ens) {
      const ens = await this.getEns(address);
      if (ens) text = ens;
    }

    return text;
  }

  async getEns(address: string): Promise<string | null> {
    const ens = await this.web3Svc.getEnsFromAddress(address);
    if (!ens) return null;
    return ens;
  }
}
