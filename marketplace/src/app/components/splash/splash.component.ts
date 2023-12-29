import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PhunkImageComponent } from '../shared/phunk-image/phunk-image.component';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule,

    PhunkImageComponent
  ],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent implements OnChanges {

  @Input() slug!: string | null | undefined;

  tokenIds: number[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.slug?.currentValue === 'ethereum-phunks') {
      this.tokenIds = this.getRandomNumbers();
    }
  }

  getRandomNumbers(): number[] {
    const numbers: Set<number> = new Set();
    while (numbers.size < 7) {
      const random = Math.floor(Math.random() * 10000);
      numbers.add(random);
    }
    return [...numbers];
  }
}
