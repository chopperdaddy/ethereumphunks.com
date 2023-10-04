import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HttpClient } from '@angular/common/http';

import { PhunkImageComponent } from '../phunk-image/phunk-image.component';

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
export class SplashComponent implements OnInit {

  tokenIds: string[] = [];

  ngOnInit(): void {
    this.tokenIds = this.getRandomNumbers();
  }

  getRandomNumbers(): string[] {
    const numbers: Set<string> = new Set();
    while (numbers.size < 7) {
      const random = Math.floor(Math.random() * 10000);
      numbers.add(`${random}`);
    }
    return [...numbers];
  }

}
