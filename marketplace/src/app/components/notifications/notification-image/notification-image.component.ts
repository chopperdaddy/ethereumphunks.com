import { Component, effect, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { hexToString } from 'viem';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
  ],
  selector: 'app-notification-image',
  templateUrl: './notification-image.component.html',
  styleUrls: ['./notification-image.component.scss'],
})
export class NotificationImageComponent {

  hashId = input<string>();
  imageData = signal<string | null>(null);

  constructor(
    private web3Svc: Web3Service,
    private dataSvc: DataService
  ) {
    effect(async () => {
      const hashId = this.hashId();
      if (!hashId) return;

      untracked(async () => {
        const data = await this.getPhunkByHashId(hashId);
        this.imageData.set(data);
      });
    });
  }

  /**
   * Fetches and processes a phunk by its transaction hash ID
   * @param hashId Transaction hash ID
   * @returns Promise resolving when image is processed
   */
  async getPhunkByHashId(hashId: string): Promise<string> {
    const sha = await this.dataSvc.fetchShaFromHashId(hashId);
    if (sha) return environment.staticUrl + '/static/images/' + sha;

    const tx = await this.web3Svc.getTransactionL1(hashId);
    return hexToString(tx.input || tx.data);
  }
}
