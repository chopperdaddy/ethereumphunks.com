import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EthService } from '@/services/eth.service';
import { StateService } from '@/services/state.service';

import { defaultPunk } from './defaultPunk';

import { Observable, catchError, debounceTime, filter, from, map, of, switchMap, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-ethscribe',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './ethscribe.component.html',
  styleUrls: ['./ethscribe.component.scss']
})

export class EthscribeComponent {

  phunkId: FormControl = new FormControl<number | null>(null);

  defaultPunk: string = defaultPunk;
  activePhunkDataUri!: string | null;

  transaction: any = {
    hash: null,
    status: null,
  };

  loadingPhunk: boolean = false;
  downloadActive: boolean = false;
  notAvailable: number = -1;

  constructor(
    private http: HttpClient,
    public stateSvc: StateService,
    public ethSvc: EthService,
  ) {
    this.phunkId.valueChanges.pipe(
      tap(() => {
        this.activePhunkDataUri = null;
        this.notAvailable = -1;
        this.loadingPhunk = true;
        this.downloadActive = false;
      }),
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
        if (!value && value !== 0) return of(defaultPunk);
        return from(this.getPhunkData(value.toString()));
      }),
      switchMap((res) => {
        this.activePhunkDataUri = res;
        if (res !== defaultPunk) return this.checkExists(res);
        return of(null);
      }),
      tap((res) => {
        this.notAvailable = res ? 1 : 0;
        this.loadingPhunk = false;
        console.log(res)
      }),
      catchError((err) => {
        console.log(err);
        this.loadingPhunk = false;
        return err;
      })
    ).subscribe();
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
  }

  async randomPhunk(): Promise<any> {
    const phunkId = Math.floor(Math.random() * 10000);
    this.phunkId.setValue(phunkId);
  }

  async getSHA256Hash(value: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
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
  }

  checkExists(data: string): Observable<any> {
    return from(this.getSHA256Hash(data)).pipe(
      switchMap((hash) => {
        return this.http.get(`${environment.ethScribeApi}/ethscriptions/exists/${hash}`);
      }),
      map((res: any) => res.ethscription),
    );
  }
}
