import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, from, of, shareReplay, startWith, switchMap, tap } from 'rxjs';

import { Collection } from '@/models/data.state';
import { SplashImage } from '@/models/image.model';
import { GlobalState } from '@/models/global-state';

import { PixelArtService } from '@/services/pixel-art.service';
import { ImageService } from '@/services/image.service';

import { selectIsMobile } from '@/state/app/app-state.selectors';
import { CollectionInfoComponent } from '@/components/collection-info/collection-info.component';
import { fromBytes } from 'viem';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    CollectionInfoComponent
  ],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent {

  isMobile$ = this.store.select(selectIsMobile);

  imagesWrapper = viewChild<ElementRef>('imagesWrapper');

  Array = Array;

  readonly IMAGE_LIMIT = 9;
  readonly MAX_IMAGE_SIZE = 2000;
  readonly defaultImage = { src: '/loadingphunk.png', type: 'loading' };
  readonly defaultImages: SplashImage[] = Array(this.IMAGE_LIMIT).fill(this.defaultImage);

  centerIndex = signal<number>(Math.floor(this.IMAGE_LIMIT / 2));

  collection = input<Collection | null>();
  collection$ = toObservable(this.collection);

  mintImage = input<string | null>();
  mintImage$ = toObservable(this.mintImage);

  auctionImage = input<string | null>();
  auctionImage$ = toObservable(this.auctionImage);

  centerImage = signal<string | null | undefined>(null);

  // Separate observable for base images that only updates when collection changes
  private baseImages$ = this.collection$.pipe(
    // tap((collection) => console.log('SplashComponent baseImages$', collection)),
    switchMap((collection) => {
      if (!collection) return of(this.defaultImages);

      const shas = collection.previews?.map(({ sha }) => sha);
      if (!shas?.length) return of(this.defaultImages);

      return from(this.createDefaultImageArray(shas, collection.slug));
    }),
    tap((images) => this.currentImages.set(images)),
    shareReplay({ bufferSize: 1, refCount: true }) // Cache the result so it doesn't recompute unnecessarily
  );

  private currentImages = signal<SplashImage[]>([...this.defaultImages]);
  imageArray$ = combineLatest([
    this.collection$,
    this.baseImages$,
    this.mintImage$,
    this.auctionImage$,
  ]).pipe(
    switchMap(([collection, baseImages, mintImage, auctionImage]) => {
      return this.isMobile$.pipe(
        switchMap((isMobile) => {

          this.centerIndex.set(isMobile ? Math.floor(this.IMAGE_LIMIT / 2) : Math.floor(this.IMAGE_LIMIT / 2) - 1);
          this.centerImage.set((mintImage && collection?.isMinting) ? mintImage : auctionImage);

          if (this.centerImage()) {
            return from(this.handleCenterImage(
              this.centerImage()!,
              this.currentImages(),
              collection?.slug,
              this.centerIndex()
            )).pipe(
              tap((updatedImages) => this.currentImages.set(updatedImages))
            );
          }
          return of(baseImages);
        })
      )
    }),
    startWith(this.defaultImages)
  );

  constructor(
    private store: Store<GlobalState>,
    private pixelArtSvc: PixelArtService,
    private imageSvc: ImageService
  ) {}

  /**
   * Handles the center image for the splash component
   *
   * @param image - The image to place at the center
   * @param images - The current images array
   * @param slug - The slug of the collection
   * @param centerIndex - The index of the center image
   * @returns The updated images array
   */
  async handleCenterImage(
    image: string,
    images: SplashImage[],
    slug: string | undefined,
    centerIndex: number
  ): Promise<SplashImage[]> {
    if (!slug) return [...images];

    const imagesWrapper = this.imagesWrapper()?.nativeElement;
    if (!imagesWrapper) return [...images];

    let newImages = [...images];
    // Place new image at center
    newImages[centerIndex] = {
      src: image,
      type: 'mint' as const
    };

    // Process any blob images that might need conversion
    await this.processArrayBlobImages(newImages, slug, centerIndex);
    return newImages;
  }

  /**
   * Creates an array of processed images from a list of SHA hashes
   *
   * @param shas - Array of SHA hashes identifying the images to fetch and process
   * @returns Promise that resolves when image processing is complete
   */
  private async createDefaultImageArray(shas: string[], slug: string): Promise<SplashImage[]> {
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

          let base64 = null;
          let type: SplashImage['type'] = 'gray';
          if (image.byteLength > this.MAX_IMAGE_SIZE) {
            const imageBase64 = this.pixelArtSvc.arrayBufferToBase64(image);
            base64 = `data:image/jpeg;base64,${imageBase64}`;
            type = 'jpeg';
          } else {
            const pixels = await this.pixelArtSvc.processPixelArtImage(image);
            const svg = this.pixelArtSvc.convertToSvg(pixels);
            const stripped = this.pixelArtSvc.stripColors(svg, slug);
            base64 = this.pixelArtSvc.convertToBase64(stripped);
            type = 'gray';
          }

          return {
            src: base64,
            type
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

  /**
   * Processes any blob images in the array
   *
   * @param images - The current images array
   * @param slug - The slug of the collection
   * @param centerIndex - The index of the center image
   * @returns The updated images array
   */
  private async processArrayBlobImages(
    images: SplashImage[],
    slug: string | undefined,
    centerIndex: number
  ): Promise<void> {
    if (!slug) return;

    // Process any blob images in the array
    for (let i = 0; i < images.length; i++) {
      if (images[i].src.startsWith('blob:') && i !== centerIndex) {
        try {
          const buffer = await fetch(images[i].src).then((res) => res.arrayBuffer());
          const pixelArtImage = await this.pixelArtSvc.processPixelArtImage(buffer);
          const svg = this.pixelArtSvc.convertToSvg(pixelArtImage);
          const newImage = this.pixelArtSvc.stripColors(svg, slug);
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
