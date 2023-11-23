import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HttpClient } from '@angular/common/http';

import { environment } from 'src/environments/environment';

import svgson, { INode } from 'svgson';
import tinycolor from 'tinycolor2';

import { firstValueFrom, from, map, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-phunk-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phunk-image.component.html',
  styleUrls: ['./phunk-image.component.scss']
})
export class PhunkImageComponent implements OnChanges {

  @Input() tokenId!: number;
  @Input() color: boolean = true;

  phunkImgSrc!: string | null;

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.tokenId && changes.tokenId.currentValue !== changes.tokenId.previousValue) {
      this.phunkImgSrc = null;
    }

    const tokenId = this.formatNumber(this.tokenId.toString());
    const url = `${environment.staticUrl}/images/phunk${tokenId}.svg`;

    firstValueFrom(
      this.http.get(url, { responseType: 'text' }).pipe(
        switchMap(data => from(svgson.parse(data))),
        map(data => this.color ? data : this.stripColors(data)),
        map(data => this.convertToBase64(data))
      )
    ).then(svg => {
      this.phunkImgSrc = svg;
    }).catch(err => {
      console.log(err);
      this.phunkImgSrc = null;
    });
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
    const string = svgson.stringify(node);
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
