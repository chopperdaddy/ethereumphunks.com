import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { DataService } from '@/services/data.service';

import { Punk } from '@/models/graph';

import { tap } from 'rxjs';

@Component({
  selector: 'app-punk-billboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LazyLoadImageModule,
    RouterModule,

    TokenIdParsePipe
  ],
  templateUrl: './punk-billboard.component.html',
  styleUrls: ['./punk-billboard.component.scss']
})

export class PunkBillboardComponent {

  @Input() data!: Punk | null;

  @ViewChild('pfp') pfp!: ElementRef;
  @ViewChild('tokenImage') tokenImage!: ElementRef;

  pfpModalOpen!: boolean;

  shapeCheck = new FormControl('square');
  resolution: string = 'pfp';

  width: number = 480;
  height: number = 480;
  scale: number = 2;

  ctx!: CanvasRenderingContext2D | null;

  constructor(
    public location: Location,
    public dataSvc: DataService
  ) {
    this.ctx?.scale(this.scale, this.scale);

    this.shapeCheck.valueChanges.pipe(
      tap((res) => this.paintCanvas())
    ).subscribe();
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CANVAS PFP STUFFS /////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  openPFPModal(): void {
    this.pfpModalOpen = true;
    this.paintCanvas();
  }

  downloadCanvas(): void {
    const link = document.createElement('a');

    if (window.innerWidth > 800) link.download = 'cryptopunk-' + this.data?.id + '.png';

    link.target = '_blank';
    link.href = this.pfp.nativeElement.toDataURL('image/png;base64');
    link.click();
    this.pfpModalOpen = false;
  }

  paintCanvas(): void {

    const shape = this.shapeCheck.value;

    const canvas = this.pfp.nativeElement as HTMLCanvasElement;

    canvas.width = this.width;
    canvas.height = this.height;

    canvas.style.width = this.width / this.scale + 'px';
    canvas.style.height = this.height / this.scale + 'px';

    this.ctx?.restore();
    this.ctx?.clearRect(0, 0, this.width, this.height);
    this.ctx = canvas.getContext('2d');

    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.imageSmoothingEnabled = false;

      this.drawPunk();

      this.ctx.fillStyle = '#C3FF00';

      if (shape === 'square') {
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      if (shape === 'round') {
        this.ctx.beginPath();
        this.ctx.arc(
          this.width / this.scale,
          this.height / this.scale,
          this.width / this.scale,
          0,
          this.scale * Math.PI
        );
        this.ctx.fill();
        this.ctx.save();
        this.ctx.clip();
      }

      if (shape === 'hex') {
        this.ctx.beginPath();
        const path = new Path2D();
        const m = document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGMatrix()
        const hex = new Path2D('M231.902238,88.7456104 C223.144463,69.1521217 212.932259,50.3330983 201.361627,32.4672826 L197.629553,26.7602925 C193.034661,19.6679209 187.01294,13.7534619 180.0012,9.44704633 C172.98946,5.14057966 165.162903,2.55018067 157.092742,1.86407789 L150.540611,1.302316 C130.212204,-0.434105333 109.786956,-0.434105333 89.4592692,1.302316 L82.9071381,1.86407789 C74.8364967,2.55018067 67.0109002,5.14057966 59.99892,9.44704633 C52.9870597,13.7534619 46.9649793,19.6679209 42.3703274,26.7602925 L38.6382528,32.5183519 C27.0678614,50.3841675 16.8552971,69.2031909 8.09762995,88.7966797 L5.27757355,95.1037337 C1.80283206,102.882731 0,111.387296 0,120 C0,128.612831 1.80283206,137.11714 5.27757355,144.896265 L8.09762995,151.203319 C16.8552971,170.797318 27.0678614,189.616342 38.6382528,207.481647 L42.3703274,213.239706 C46.9649793,220.33195 52.9870597,226.247047 59.99892,230.553463 C67.0109002,234.859879 74.8364967,237.450367 82.9071381,238.135972 L89.4592692,238.697734 C109.786956,240.434089 130.212204,240.434089 150.540611,238.697734 L157.092742,238.135972 C165.168903,237.44143 172.99906,234.839451 180.0108,230.518991 C187.02374,226.198532 193.041861,220.26939 197.629553,213.163102 L201.361627,207.405043 C212.932259,189.539738 223.144463,170.720715 231.902238,151.126715 L234.722294,144.819661 C238.196364,137.040536 240,128.536227 240,119.923395 C240,111.310692 238.196364,102.806128 234.722294,95.0271298 L231.902238,88.7456104 Z')
        const t = m.scale(2)
        path.addPath(hex, t);
        this.ctx.fill(path);
        this.ctx.save();
        this.ctx.clip(path);
      }

      if (shape === 'trans') {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawPunk();
      }
    }
  }

  drawPunk(): void {
    const tokenImage = this.tokenImage.nativeElement as HTMLImageElement;
    const req = new XMLHttpRequest();
    req.open('GET', tokenImage.src, true);
    req.onload = () => {
      const parser = new DOMParser();
      const result = parser.parseFromString(req.responseText, 'text/xml');
      const inlineSVG = result.getElementsByTagName('svg')[0];

      inlineSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      inlineSVG.setAttribute('width', this.width + 'px');
      inlineSVG.setAttribute('height', this.height + 'px');

      const svg64 = btoa(new XMLSerializer().serializeToString(inlineSVG));
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = image64;

      img.onload = () => {
        this.ctx?.drawImage(
          img,
          0,
          0,
          this.width,
          this.height,
        );
      }
    };

    req.send();
  }

}
