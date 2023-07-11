import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StateService {

  private web3Connected = new BehaviorSubject<boolean>(false);
  web3Connected$ = this.web3Connected.asObservable();

  private walletAddress = new BehaviorSubject<any>(null);
  walletAddress$ = this.walletAddress.asObservable();

  constructor() { }

  setWalletAddress(address: string | null | undefined): void {
    address = address?.toLowerCase();
    this.walletAddress.next(address);
  }

  getWalletAddress(): string | null {
    return this.walletAddress.getValue();
  }

  setWeb3Connected(status: boolean): void {
    this.web3Connected.next(status);
  }

  getWeb3Connected(): boolean {
    return this.web3Connected.getValue();
  }
}
