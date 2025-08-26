import { CommonModule, Location } from '@angular/common';
import { Component, ElementRef, ViewChild, effect, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DataService } from '@/services/data.service';
import { EthscriptionService } from '@/services/ethscription.service';

import { Phunk } from '@/models/db';

import { filter, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

  phunk = input<Phunk | null>();

  @ViewChild('pfp') pfp!: ElementRef;

  ctx!: CanvasRenderingContext2D | null;
  width: number = 480;
  height: number = 480;
  scale: number = 2;
  transparentCheck = new FormControl(false);

  pfpOptionsActive = signal(false);
  downloadEnabled = signal(false);
  customizeEnabled = signal(true);

  constructor(
    private ethscriptionSvc: EthscriptionService,
    public location: Location,
    public dataSvc: DataService
  ) {
    effect(() => {
      if (!this.phunk()) return;
      const phunk = this.phunk()!;

      untracked(() => {
        this.paintCanvas(phunk);
      });
    });

    this.transparentCheck.valueChanges.pipe(
      filter(() => !!this.phunk()),
      tap(() => this.paintCanvas(this.phunk()!)),
      takeUntilDestroyed()
    ).subscribe();
  }

  async paintCanvas(
    phunk: Phunk,
  ): Promise<void> {
    if (!phunk) return;

    // Disable download while painting
    this.downloadEnabled.set(false);

    try {
      const transparent = this.transparentCheck.value;
      const canvas = this.pfp.nativeElement as HTMLCanvasElement;

      // Set physical canvas dimensions
      canvas.width = this.width;
      canvas.height = this.height;

      // Set display dimensions
      canvas.style.width = this.width / this.scale + 'px';
      canvas.style.height = this.height / this.scale + 'px';

      // Get fresh context
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) return;

      // Clear canvas and set rendering options
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.imageSmoothingEnabled = false;

      // Apply scaling
      this.ctx.scale(this.scale, this.scale);

      // If not transparent, fill with background color first
      if (!transparent && phunk.isSupported) {
        this.ctx.fillStyle = '#C3FF00';
        this.ctx.fillRect(0, 0, this.width / this.scale, this.height / this.scale);
      }

      const hasBackgrounds = phunk?.collection?.hasBackgrounds;

      // Draw the phunk image
      const dataUrl = await this.getPunkImage(phunk, !!(transparent && hasBackgrounds));
      const image = await this.createImage(dataUrl);

      if (!image) return;

      this.ctx.drawImage(
        image,
        0,
        0,
        this.width / this.scale,
        this.height / this.scale
      );

      // Enable download after painting is complete
      this.downloadEnabled.set(true);
    } catch (error) {
      console.error('Error painting canvas:', error);
      // Keep download disabled on error
      this.downloadEnabled.set(false);
    }
  }

  async getPunkImage(phunk: Phunk, transparentVersion: boolean): Promise<string | undefined> {
    const decodedData = await this.ethscriptionSvc.fetchImage(phunk, transparentVersion);
    if (decodedData?.mimeType === 'image/gif') {
      this.customizeEnabled.set(false);
    }
    return decodedData?.data;
  }

  async createImage(dataUrl: string | undefined): Promise<HTMLImageElement | undefined> {
    if (!dataUrl) return;
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = err => {
        reject(err);
      };
      img.src = dataUrl;
    });
  }

  downloadCanvas(): void {
    if (!this.phunk()) return;

    const name = this.phunk()!.collection?.singleName?.replace(' ', '-') + '#' + this.phunk()!.tokenId + (this.transparentCheck.value ? '_transparent' : '');
    const link = document.createElement('a');
    if (window.innerWidth > 800) link.download = name + '.png';

    link.target = '_blank';
    link.href = this.pfp.nativeElement.toDataURL('image/png;base64');
    link.click();
    this.pfpOptionsActive.set(false);
  }

  togglePfpOptions(): void {
    this.pfpOptionsActive.update(active => !active);
  }

  clearCanvas(): void {
    this.ctx?.clearRect(0, 0, this.width, this.height);
  }
}
