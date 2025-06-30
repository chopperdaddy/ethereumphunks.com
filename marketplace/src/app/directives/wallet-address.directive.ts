import { Directive, ElementRef, HostListener, input, effect, untracked, output } from '@angular/core';

import { Web3Service } from '@/services/web3.service';
import { environment } from '@environments/environment';

@Directive({
  standalone: true,
  selector: 'app-address'
})

export class WalletAddressDirective {

  address = input<string | null>(null);
  ens = input<boolean>(true);

  clicked = output<void>();

  constructor(
    private el: ElementRef,
    public web3Svc: Web3Service
  ) {
    effect(() => {
      const address = this.address();
      const ens = this.ens();
      if (address) {
        untracked(() => this.setAddress(address, ens));
      }
    });
  }

  @HostListener('click') onClick(): void {
    this.clicked.emit();
  }

  async setAddress(address: string, ens: boolean) {
    const el = this.el.nativeElement as HTMLElement;

    if (address === environment.agent.address) {
      el.innerText = environment.agent.name;
      return;
    }

    el.innerText = address.slice(0, 5) + '...' + address.slice(-5);

    if (ens) {
      const ens = await this.getEns(address);
      if (ens) el.innerText = ens;
    }
  }

  async getEns(address: string): Promise<string | null> {
    const ens = await this.web3Svc.getEnsFromAddress(address);
    if (!ens) return null;
    return ens;
  }

  async copyToClipboard(): Promise<void> {
    // if (!navigator.clipboard) return;
    // if (!this.address) return;
    // await navigator.clipboard.writeText(this.address);
  }

}
