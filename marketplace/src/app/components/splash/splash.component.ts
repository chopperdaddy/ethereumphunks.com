import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LazyLoadImageModule } from 'ng-lazyload-image';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, from, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { Collection } from '@/models/data.state';

import { PixelArtService } from '@/services/pixel-art.service';
import { ImageService } from '@/services/image.service';

import { SplashImage } from '@/models/image.model';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule
  ],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent {

  imagesWrapper = viewChild<ElementRef>('imagesWrapper');

  Array = Array;

  readonly IMAGE_LIMIT = 9;
  readonly MAX_IMAGE_SIZE = 2000;
  readonly defaultImage = { src: '/loadingphunk.png', type: 'loading' };
  readonly defaultImages: SplashImage[] = Array(this.IMAGE_LIMIT).fill(this.defaultImage);

  collection = input<Collection | null>();
  collection$ = toObservable(this.collection);

  mintImage = input<string | null>();
  mintImage$ = toObservable(this.mintImage);

  auctionImage = input<string | null>();
  auctionImage$ = toObservable(this.auctionImage);

  // Separate observable for base images that only updates when collection changes
  private baseImages$ = this.collection$.pipe(
    switchMap((collection) => {
      if (!collection) return of(this.defaultImages);

      const shas = collection.previews?.map(({ sha }) => sha);
      if (!shas?.length) return of(this.defaultImages);

      return from(this.createDefaultImageArray(shas));
    }),
    tap((images) => this.currentImages.set(images)),
    shareReplay(1) // Cache the result so it doesn't recompute unnecessarily
  );

  private currentImages = signal<SplashImage[]>([...this.defaultImages]);
  imageArray$ = combineLatest([
    this.collection$,
    this.baseImages$,
    this.mintImage$,
    this.auctionImage$,
  ]).pipe(
    switchMap(([collection, baseImages, mintImage, auctionImage]) => {
      // Apply center image to current images
      const centerImage = (mintImage && collection?.isMinting) ? mintImage : auctionImage;
      if (centerImage) {
        return from(this.handleCenterImage(centerImage, this.currentImages())).pipe(
          tap((updatedImages) => {
            this.currentImages.set(updatedImages);
          })
        );
      }

      return of(this.currentImages());
    }),
    startWith(this.defaultImages)
  );

  constructor(
    private pixelArtSvc: PixelArtService,
    private imageSvc: ImageService
  ) {}

  // /**
  //  * Creates an array of processed images from a list of SHA hashes
  //  *
  //  * @param shas - Array of SHA hashes identifying the images to fetch and process
  //  * @returns Promise that resolves when image processing is complete
  //  */
  async createDefaultImageArray(shas: string[]): Promise<SplashImage[]> {
    if (!shas?.length) return [];

    const imageArray = [...this.defaultImages];
    let validImages = 0;
    let currentIndex = 0;

    // Keep processing until we have 9 valid images or run out of SHAs
    while (validImages < this.IMAGE_LIMIT && currentIndex < shas.length) {
      // Process next batch of images in parallel
      const batchSize = Math.min(5, shas.length - currentIndex);
      const batchPromises = shas.slice(currentIndex, currentIndex + batchSize).map(async (sha) => {
        try {
          const image = await this.imageSvc.fetchSupportedImageBySha(sha);
          if (image.byteLength > this.MAX_IMAGE_SIZE) return null;

          const pixels = await this.pixelArtSvc.processPixelArtImage(image);
          const svg = this.pixelArtSvc.convertToSvg(pixels);
          const stripped = this.pixelArtSvc.stripColors(svg);
          const base64 = this.pixelArtSvc.convertToBase64(stripped);

          return {
            src: base64,
            type: 'gray' as const
          };
        } catch (error) {
          console.error(`Error processing image ${sha}:`, error);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);

      // Add valid results to our array
      for (const result of results) {
        if (result && validImages < this.IMAGE_LIMIT) {
          imageArray[validImages] = result;
          validImages++;
        }
      }

      currentIndex += batchSize;
    }

    return imageArray;
  }

  async handleCenterImage(image: string, images: SplashImage[]): Promise<SplashImage[]> {
    const imagesWrapper = this.imagesWrapper()?.nativeElement;
    if (!imagesWrapper) return [...images]; // Return copy of original images if wrapper not available

    const centerIndex = Math.floor(this.IMAGE_LIMIT / 2);
    let newImages = [...images];

    // Place new image at center
    newImages[centerIndex] = {
      src: image,
      type: 'mint' as const
    };

    // Process any blob images that might need conversion
    await this.processArrayBlobImages(newImages);

    return newImages;
  }

  private async processArrayBlobImages(images: SplashImage[]): Promise<void> {
    const centerIndex = Math.floor(this.IMAGE_LIMIT / 2);

    // Process any blob images in the array
    for (let i = 0; i < images.length; i++) {
      if (images[i].src.startsWith('blob:') && i !== centerIndex) {
        try {
          const buffer = await fetch(images[i].src).then((res) => res.arrayBuffer());
          const pixelArtImage = await this.pixelArtSvc.processPixelArtImage(buffer);
          const svg = this.pixelArtSvc.convertToSvg(pixelArtImage);
          const newImage = this.pixelArtSvc.stripColors(svg);
          images[i] = {
            src: this.pixelArtSvc.convertToBase64(newImage),
            type: 'gray' as const
          };
        } catch (error) {
          console.error(`Error processing blob image at index ${i}:`, error);
        }
      }
    }
  }
}
