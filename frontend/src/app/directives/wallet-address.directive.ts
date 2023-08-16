import { Directive, ElementRef, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { Web3Service } from '@/services/web3.service';

@Directive({
  standalone: true,
  selector: 'app-wallet-address'
})

export class WalletAddressDirective implements OnChanges {

  @Input() address!: string;

  constructor(
    private el: ElementRef,
    public web3Svc: Web3Service
  ) {}

  ngOnChanges(changes: SimpleChanges): void {

    const el = this.el.nativeElement as HTMLElement;
    const address = changes.address.currentValue;

    if (address) {
      el.innerText = address.substr(0, 5) + '...' + address.substr(address.length - 5, address.length);
      this.getEns(el, address);
      return;
    }

    el.innerText = '';
  }

  async getEns(el: HTMLElement, address: string): Promise<void> {
    const ens = await this.web3Svc.getEnsFromAddress(address);
    if (ens) el.innerText = ens;
  }

}
