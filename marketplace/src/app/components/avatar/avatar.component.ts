import { Component, input, effect, model, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { environment } from '@environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
  ],
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent {

  address = input.required<string>();
  src = model<string>('');

  constructor(
    private web3Svc: Web3Service,
    private dataSvc: DataService
  ) {
    effect(async () => {
      const address = this.address();

      if (address === environment.agent.address) {
        untracked(() => this.src.set(`/bot-pfp.png`));
        return;
      }

      let avatar = await this.web3Svc.getEnsAvatar(address);
      if (avatar) {
        untracked(() => this.src.set(avatar!));
        return;
      }

      avatar = await this.dataSvc.getUserAvatar(address);
      if (avatar) {
        untracked(() => this.src.set(`${environment.staticUrl}/static/images/${avatar}`));
        return;
      }
    });
  }

}
