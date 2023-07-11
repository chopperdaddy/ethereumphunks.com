import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EthService } from '@/services/eth.service';
import { StateService } from '@/services/state.service';

import { defaultPunk } from './defaultPunk';

import { Observable, catchError, debounceTime, filter, from, map, of, switchMap, tap } from 'rxjs';

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
  activePhunkBase64!: string;

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
        this.activePhunkBase64 = '';
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
        this.activePhunkBase64 = res;
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
      const base64 = btoa(serialized);
      const ethscription = 'data:image/svg+xml;base64,' + base64;
      return ethscription;
    } catch (error) {
      console.log(error);
    }
  }

  async ethscribePhunk(): Promise<any> {
    const ethscription = this.activePhunkBase64;
    console.log(ethscription);

    const hash = await this.ethSvc.ethscribe(ethscription);
    console.log(hash);

    if (!hash) return;

    const receipt = await this.ethSvc.waitForTransaction(hash);
    console.log(receipt);
  }

  async randomPhunk(): Promise<any> {
    const phunkId = Math.floor(Math.random() * 10000);
    this.phunkId.setValue(phunkId);
  }

  checkExists(data: string): Observable<any> {
    const url = 'https://goerli-api.ethscriptions.com/api/ethscriptions/exists/';

    return from(this.getSHA256Hash(data)).pipe(
      switchMap((hash) => {
        return this.http.get(`${url}/${hash}`);
      }),
      map((res: any) => res.ethscription),
    );
  }

  async getSHA256Hash(value: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }

  async download(background: boolean = false): Promise<any> {

    const ethscription = this.activePhunkBase64

    const svg = atob(ethscription.split(',')[1]);

    if (background) {
      console.log(svg)
    }

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    // link.download = `${phunkId}.svg`;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async addBackgroundAndDownload(): Promise<void> {
    const ethscription = this.activePhunkBase64
    const svgString = atob(ethscription.split(',')[1]);

    // Parse SVG string into an actual SVG document
    const parser = new DOMParser();
    const svgDocument = parser.parseFromString(svgString, 'image/svg+xml');

    // Create a new rectangle for the background
    const backgroundRect = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('width', '100%');
    backgroundRect.setAttribute('height', '100%');
    backgroundRect.setAttribute('fill', 'rgb(195, 255, 0)');

    // Insert the rectangle as the first child of the SVG
    svgDocument.documentElement.insertBefore(backgroundRect, svgDocument.documentElement.firstChild);

    // Serialize the modified SVG back into a string
    const serializer = new XMLSerializer();
    const newSvgString = serializer.serializeToString(svgDocument.documentElement);

    // Continue with download process as before
    const blob = new Blob([newSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank'; // Open in new tab
    link.style.display = 'none';  // Ensure the link isn't visible
    document.body.appendChild(link);  // Append the link to the document
    link.click();  // Simulate click to start download
    document.body.removeChild(link);  // Clean up by removing the link
  }
}
