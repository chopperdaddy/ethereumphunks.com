import { Directive, ElementRef, HostListener, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { Web3Service } from '@/services/web3.service';

@Directive({
  standalone: true,
  selector: 'app-address'
})

export class WalletAddressDirective implements OnChanges {

  @Input() address!: string | null;
  @Input() ens: boolean = true;
  @Input() clickCopy: boolean = false;

  constructor(
    private el: ElementRef,
    public web3Svc: Web3Service
  ) {
    this.el.nativeElement.style.cursor = 'pointer';
  }

  @HostListener('click') onClick(): void {
    if (this.clickCopy) this.copyToClipboard();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const el = this.el.nativeElement as HTMLElement;
    const address = changes.address.currentValue;

    if (address) {
      el.innerText = address.substr(0, 5) + '...' + address.substr(address.length - 5, address.length);
      if (this.ens) this.getEns(el, address);
      return;
    }
    el.innerText = '';
  }

  async getEns(el: HTMLElement, address: string): Promise<void> {
    const ens = await this.web3Svc.getEnsFromAddress(address);
    if (ens) el.innerText = ens;
  }

  async copyToClipboard(): Promise<void> {
    if (!navigator.clipboard) return;
    if (!this.address) return;
    await navigator.clipboard.writeText(this.address);
  }

}
