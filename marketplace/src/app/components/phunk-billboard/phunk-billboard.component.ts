import { Component, effect, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { Phunk } from '@/models/db';
import { DecodedData } from '@/models/ethscriptions';

import { EthscriptionService } from '@/services/ethscription.service';

@Component({
  selector: 'app-phunk-billboard',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    RouterModule
  ],
  templateUrl: './phunk-billboard.component.html',
  styleUrls: ['./phunk-billboard.component.scss']
})
export class PhunkBillboardComponent {

  phunk = input.required<Phunk | null>();
  contentData = signal<DecodedData | null>(null);

  constructor(
    private ethscriptionSvc: EthscriptionService
  ) {
    effect(() => {
      const phunk = this.phunk();
      if (!phunk) return;

      untracked(async () => {
        const data = await this.ethscriptionSvc.fetchImage(phunk, false);
        this.contentData.set(data);
      });
    });
  }
}
