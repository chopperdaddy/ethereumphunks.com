import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkImageComponent } from '../shared/phunk-image/phunk-image.component';

import { INode, parse, stringify } from 'svgson';
import tinycolor from 'tinycolor2';

import { catchError, filter, firstValueFrom, from, map, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,

    PhunkImageComponent
  ],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent implements OnChanges {

  @Input() slug!: string | null | undefined;

  random: string[] = [];
  images: string[] = [];

  constructor(
    private http: HttpClient
  ) {}

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    // console.log(changes);

    if (
      changes.slug &&
      changes.slug.currentValue &&
      changes.slug.currentValue === 'ethereum-phunks' &&
      changes.slug.currentValue !== changes.slug.previousValue
    ) {
      const random = this.getRandomNumbers();
      const images = await Promise.all(random.map(num => this.getPhunkByTokenId(num)));
      this.random = random;
      this.images = images;
    } else {
      this.random = [];
      this.images = [];
    }
  }

  async getPhunkByTokenId(tokenId: string): Promise<any> {
    const url = `https://punkcdn.com/data/images/phunk${('000' + tokenId).slice(-4)}.svg`;

    return await firstValueFrom(
      this.http.get(url, { responseType: 'text' }).pipe(
        filter(data => !!data),
        switchMap(data => from(parse(data))),
        map(data => this.stripColors(data)),
        map(data => this.convertToBase64(data)),
        catchError((err) => {
          console.error(err);
          return of(null);
        })
      )
    );
  }

  stripColors(node: INode): INode {
    for (const child of node.children) {
      if (child.name === 'rect' && child.attributes?.fill) {
        const color = tinycolor(child.attributes.fill);
        const alpha = tinycolor(color).getBrightness() / 255;
        const opaque = tinycolor({ r: 0, g: 0, b: 0, a: 1 - alpha });

        const filter = [
          '#ffffffff', // White
          '#ead9d9ff', // Albino Skin Tone
          '#dbb180ff', // Light Skin Tone
          '#ae8b61ff', // Mid Skin Tone
          '#713f1dff', // Dark Skin Tone
          '#7da269ff', // Zombie Skin Tone
          '#352410ff', // Ape Skin Tone
          '#c8fbfbff', // Alien Skin Tone
        ];

        // Remove Skin Tone
        if (filter.indexOf(child.attributes.fill) > -1) child.attributes.fill = '#00000000';
        // Remove Transparent
        else if (child.attributes.fill === '#000000ff') continue;
        else child.attributes.fill = opaque.toString('hex8');
      }
    }
    return node;
  }

  convertToBase64(node: INode): string {
    const string = stringify(node);
    const decoded = unescape(encodeURIComponent(string));
    const base64 = btoa(decoded);
    return `data:image/svg+xml;base64,${base64}`;
  }

  getRandomNumbers(): string[] {
    const numbers: Set<string> = new Set();
    while (numbers.size < 7) {
      const random = Math.floor(Math.random() * 10000);
      const formatted = String(random).padStart(4, '0');
      numbers.add(formatted);
    }
    return [...numbers];
  }

  formatNumber(num: string): string | null {
    if (!num) return null;
    return String(num).padStart(4, '0');
  }
}
