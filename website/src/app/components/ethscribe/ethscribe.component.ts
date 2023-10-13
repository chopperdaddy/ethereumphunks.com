import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EthService } from '@/services/eth.service';
import { StateService } from '@/services/state.service';
import { DataService } from '@/services/data.service';

import { OwnedComponent } from '../owned/owned.component';

import { defaultPhunk } from './defaultPhunk';

import { EthPhunk } from '@/models/ethPhunk';

import { Observable, catchError, debounceTime, from, map, of, switchMap, tap, interval, startWith } from 'rxjs';

@Component({
  selector: 'app-ethscribe',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    OwnedComponent
  ],
  templateUrl: './ethscribe.component.html',
  styleUrls: ['./ethscribe.component.scss']
})

export class EthscribeComponent {

  phunkId: FormControl = new FormControl<number | null>(null);
  transferAddress: FormControl = new FormControl<string>('');

  defaultPhunk: string = defaultPhunk;
  activePhunkDataUri!: string | null;
  activeOwnedEthPhunk!: EthPhunk | null;
  isLocked: boolean = false;

  transaction: any = {
    hash: null,
    status: null,
  };

  error!: string | null;

  notAvailable: number = -1;
  loadingPhunk: boolean = false;
  downloadActive: boolean = false;

  transferActive: boolean = false;
  ethscribing: boolean = false;
  transferring: boolean = false;

  ethPhunks$!: Observable<EthPhunk[] | null>;
  mintCount$: Observable<number> = of(0);

  constructor(
    public stateSvc: StateService,
    public ethSvc: EthService,
    private dataSvc: DataService,
  ) {

    this.ethPhunks$ = this.stateSvc.walletAddress$.pipe(
      switchMap((address: string | null) => {
        if (!address) return of([]);
        return from(this.dataSvc.getUserEthPhunks(address));
      }),
      map((phunks: EthPhunk[]) => {
        if (!phunks.length) return null;
        return phunks;
      })
    );

    let notAvailable = -1;
    this.phunkId.valueChanges.pipe(
      tap(() => this.reset()),
      debounceTime(500),
      map((value) => {
        if (value > 10000) {
          this.phunkId.setValue(9999);
          return 9999;
        }
        if (value < 0) {
          this.phunkId.setValue(0);
          return 0;
        }
        return value;
      }),
      switchMap((value) => {
        if (!value && value !== 0) return of(defaultPhunk);
        return from(this.getPhunkData(value.toString()));
      }),
      switchMap((res) => {
        this.activePhunkDataUri = res;
        if (res !== defaultPhunk) return this.dataSvc.checkEthPhunkExists(res);
        return of(null);
      }),
      tap((res) => notAvailable = res ? 1 : 0),
      switchMap((res) => this.checkOwned(res?.transaction_hash)),
      tap((res) => {
        this.notAvailable = notAvailable;
        this.loadingPhunk = false;
        this.activeOwnedEthPhunk = res;
        if (res) this.isLocked = this.unlockPhunk(res.hashId);
      }),
      catchError((err) => {
        console.log(err);
        this.loadingPhunk = false;
        return err;
      })
    ).subscribe();

    this.mintCount$ = interval(5000).pipe(
      startWith(0),
      switchMap(_ => this.dataSvc.getMintCount()),
    );
  }

  reset(): void {
    this.activePhunkDataUri = null;
    this.notAvailable = -1;
    this.loadingPhunk = true;
    this.downloadActive = false;
    this.ethscribing = false;

    this.transferActive = false;
    this.transferring = false;

    this.activeOwnedEthPhunk = null;
    this.isLocked = false;

    this.error = null;

    this.transaction = {
      hash: null,
      status: null,
    };
  }

  async getPhunkData(phunkId: string): Promise<any> {
    try {
      const punkSvgString = await this.ethSvc.getPunkImage(phunkId);

      const span = document.createElement('span');
      span.innerHTML = punkSvgString.split(',')[1];

      let svgElement = span.firstChild as SVGSVGElement;
      let rectElements = svgElement.querySelectorAll('rect');
      let viewBoxWidth = svgElement.viewBox.baseVal.width;

      rectElements.forEach((rect) => {
        let x = parseFloat(rect.getAttribute('x')!);
        let width = parseFloat(rect.getAttribute('width')!);
        let newX = viewBoxWidth - (x + width);
        rect.setAttribute('x', newX.toString());
      });

      const serialized = new XMLSerializer().serializeToString(svgElement);
      const ethscription = 'data:image/svg+xml,' + encodeURIComponent(serialized);

      const fileSizeInBytes = ethscription.length / 2;
      const fileSizeInKb = fileSizeInBytes / 1024;
      console.log('File size in kilobytes:', fileSizeInKb);

      return ethscription;
    } catch (error) {
      console.log(error);
    }
  }

  async ethscribePhunk(): Promise<any> {
    this.ethscribing = true;

    await this.ethSvc.switchNetwork();

    const ethscription = this.activePhunkDataUri;
    const hash = await this.ethSvc.ethscribe(ethscription);
    this.transaction = {
      hash,
      status: 'pending',
    };

    if (!hash) return;

    const receipt = await this.ethSvc.waitForTransaction(hash);
    this.transaction = {
      hash: receipt.transactionHash,
      status: 'complete',
    };

    this.lockPhunk(receipt.transactionHash);
    this.isLocked = true;
    this.ethscribing = false;
  }

  async randomPhunk(): Promise<any> {
    const phunkId = Math.floor(Math.random() * 10000);
    this.phunkId.setValue(phunkId);
  }

  async download(background: boolean = false): Promise<any> {

    const ethscription = this.activePhunkDataUri;
    if (!ethscription) return;

    let svg = decodeURIComponent(ethscription!.split(',')[1]);

    if (background) {
      const parser = new DOMParser();
      const svgDocument = parser.parseFromString(svg, 'image/svg+xml');

      const backgroundRect = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
      backgroundRect.setAttribute('width', '100%');
      backgroundRect.setAttribute('height', '100%');
      backgroundRect.setAttribute('fill', 'rgb(195, 255, 0)');

      svgDocument.documentElement.insertBefore(backgroundRect, svgDocument.documentElement.firstChild);

      const serializer = new XMLSerializer();
      svg = serializer.serializeToString(svgDocument.documentElement);
    }

    const svgBase64 = btoa(svg);
    const url = `data:image/svg+xml;base64,${svgBase64}`;

    const win = window.open();
    win?.document.write(`<img src="${url}" />`);
    this.downloadActive = false;
  }

  checkOwned(hashId: string): Observable<EthPhunk | null> {
    if (!hashId) return of(null);
    return this.ethPhunks$.pipe(
      map((phunks) => {
        if (!phunks || !phunks.length) return null;
        return phunks.filter((phunk) => phunk.hashId.toLowerCase() === hashId.toLowerCase())[0] || null;
      }),
    );
  }

  async transferEthPhunk(): Promise<any> {
    try {
      this.error = null;
      this.transferring = true;
      this.transferActive = false;

      let toAddress: string = this.transferAddress.value;
      if (!toAddress) throw new Error('Invalid address');

      await this.ethSvc.switchNetwork();

      if (toAddress.endsWith('.eth')) {
        const resolvedAddress = await this.ethSvc.getEnsOwner(toAddress);
        if (resolvedAddress) toAddress = resolvedAddress;
        else throw new Error('Invalid ENS name');
      }

      const validAddress = this.ethSvc.verifyAddress(toAddress);
      if (!validAddress) throw new Error('Invalid address');

      const hash = await this.ethSvc.transferEthPhunk(this.activeOwnedEthPhunk!.hashId, toAddress);
      if (!hash) return;

      this.lockPhunk(this.activeOwnedEthPhunk!.hashId);
      this.isLocked = true;

      console.log(hash);
      this.transaction = {
        hash,
        status: 'pending',
      };

      const receipt = await this.ethSvc.waitForTransaction(hash);
      console.log(receipt);
      this.transaction = {
        hash: receipt.transactionHash,
        status: 'complete',
      };

      this.transferring = false;
      this.transferAddress.setValue('');
    } catch (error: any) {
      console.log(error);
      this.error = error.message || error || 'Unknown error, check devtools console.';
      this.transferring = false;
    }
  }

  lockPhunk(hashId: string): void {
    hashId = hashId.toLowerCase();
    const lockedPhunks = JSON.parse(localStorage.getItem('lockedPhunks') || '[]');
    lockedPhunks.push({ hashId, timestamp: Date.now() + 300000 }); // Locks the phunk for 5 minutes
    localStorage.setItem('lockedPhunks', JSON.stringify(lockedPhunks));
  }

  unlockPhunk(hashId: string): boolean { // Returns isLocked
    if (!hashId) return false;
    hashId = hashId?.toLowerCase();
    const lockedPhunks = JSON.parse(localStorage.getItem('lockedPhunks') || '[]');
    const match = lockedPhunks.find((phunk: any) => phunk?.hashId === hashId);

    if (match) {
      // Phunk exists in lockedPhunks. Check if it's locked or not.
      if (match.timestamp < Date.now()) {
        // The phunk is unlocked
        const newArr = lockedPhunks.filter((phunk: any) => phunk.hashId !== hashId);
        localStorage.setItem('lockedPhunks', JSON.stringify(newArr));
        return false; // Unlocked
      } else {
        // The phunk is still locked
        return true; // Locked
      }
    } else {
      // Phunk doesn't exist in lockedPhunks, hence it's not locked
      return false; // Unlocked
    }
  }
}
