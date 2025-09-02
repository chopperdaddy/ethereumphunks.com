import { Component, effect, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { DataService } from '@/services/data.service';
import { ImageService } from '@/services/image.service';

import { Phunk } from '@/models/db';

import { AuctionComponent } from './auction/auction.component';
import { Collection } from '@/models/data.state';

@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    AuctionComponent
  ],
  templateUrl: './auctions.component.html',
  styleUrls: ['./auctions.component.scss']
})
export class AuctionsComponent {

  auctions = input<Phunk[] | null | undefined>();
  auctionImage = output<string | null>();

  collection = input<Collection | null | undefined>();

  activeAuction = signal<Phunk | null>(null);
  activeAuctionIndex = signal(0);

  constructor(
    public dataSvc: DataService,
    public imageSvc: ImageService
  ) {

    effect(async () => {
      const auctions = this.auctions();
      // console.log({auctions});
      if (!auctions?.length) return;

      untracked(async () => {
        const index = this.activeAuctionIndex();
        const auction = auctions[index];
        if (!auction || !auction.sha) return;

        const image = await this.imageSvc.fetchSupportedImageBySha(auction.sha);
        const imageUrl = URL.createObjectURL(new Blob([image]));

        this.auctionImage.emit(imageUrl);
        this.activeAuction.set(auction);
      });
    });

  }

  async nextAuction() {
    const auctions = this.auctions();
    if (!auctions?.length) return;
    this.activeAuctionIndex.set(this.activeAuctionIndex() === auctions.length - 1 ? 0 : this.activeAuctionIndex() + 1);

    const auction = auctions[this.activeAuctionIndex()];
    if (!auction || !auction.sha) return;

    const image = await this.imageSvc.fetchSupportedImageBySha(auction.sha);
    const imageUrl = URL.createObjectURL(new Blob([image]));
    this.auctionImage.emit(imageUrl);
    this.activeAuction.set(auction);
  }
}
