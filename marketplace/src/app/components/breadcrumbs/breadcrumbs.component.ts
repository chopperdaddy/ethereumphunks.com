import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, Inject, Input, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DataService } from '@/services/data.service';

import { Phunk } from '@/models/db';

import { firstValueFrom, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { HISTORY } from '@ng-web-apis/common';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  selector: 'app-breadcrumbs',
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent {

  @Input() phunk!: Phunk | null;

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
    @Inject(HISTORY) public history: History,
    private http: HttpClient,
    private tokenIdParsePipe: TokenIdParsePipe,
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

  async drawPhunk(): Promise<void> {
    const dataUrl = await this.getPunkImage();
    if (!dataUrl) return;
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.ctx?.drawImage(
          img,
          0,
          0,
          this.width,
          this.height
        );
        resolve();
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = dataUrl;
    });
  }

  async getPunkImage(): Promise<string | undefined> {
    if (!this.phunk) return;
    const imgUrl = this.dataSvc.staticUrl + '/images/' + this.phunk.sha + '.png';
    const response = await firstValueFrom(this.http.get(imgUrl, { responseType: 'blob' }));
    const blob = new Blob([response], { type: 'image/png' });
    return URL.createObjectURL(blob);
  }

  downloadCanvas(): void {
    if (!this.phunk) return;

    const name = this.phunk.singleName?.replace(' ', '-') + '#' + this.phunk.tokenId;
    const link = document.createElement('a');
    if (window.innerWidth > 800) link.download = name + '.png';

    link.target = '_blank';
    link.href = this.pfp.nativeElement.toDataURL('image/png;base64');
    link.click();
    this.pfpOptionsActive = false;
  }
}
