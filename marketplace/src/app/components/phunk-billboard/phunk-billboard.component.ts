import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { DataService } from '@/services/data.service';

import { Phunk } from '@/models/graph';

import { tap } from 'rxjs';

@Component({
  selector: 'app-phunk-billboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LazyLoadImageModule,
    RouterModule,

    TokenIdParsePipe
  ],
  templateUrl: './phunk-billboard.component.html',
  styleUrls: ['./phunk-billboard.component.scss']
})

export class PhunkBillboardComponent implements OnChanges {

  @Input() data!: Phunk | null;

  @ViewChild('pfp') pfp!: ElementRef;
  @ViewChild('tokenImage') tokenImage!: ElementRef;

  pfpOptionsActive!: boolean;

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
      tap(() => this.paintCanvas())
    ).subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.data && this.pfpOptionsActive) this.pfpOptionsActive = false;
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // CANVAS PFP STUFFS /////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  togglePfpOptions(): void {
    this.pfpOptionsActive = !this.pfpOptionsActive;
    if (this.pfpOptionsActive) this.paintCanvas();
    else this.clearCanvas();
  }

  downloadCanvas(): void {
    const link = document.createElement('a');

    if (window.innerWidth > 800) link.download = 'EthereumPhunk#' + this.data?.id + '.png';

    link.target = '_blank';
    link.href = this.pfp.nativeElement.toDataURL('image/png;base64');
    link.click();
    this.pfpOptionsActive = false;
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
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.imageSmoothingEnabled = false;

    this.drawPhunk();

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

    if (shape === 'trans') {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.drawPhunk();
    }
  }

  clearCanvas(): void {
    this.ctx?.clearRect(0, 0, this.width, this.height);
  }

  drawPhunk(): void {
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
