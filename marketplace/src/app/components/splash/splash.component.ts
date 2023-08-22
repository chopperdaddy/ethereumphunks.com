import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HttpClient } from '@angular/common/http';

import { environment } from 'src/environments/environment';

import svgson, { INode } from 'svgson';
import tinycolor from 'tinycolor2';

import { forkJoin, from, map, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash.component.html',
  styleUrls: ['./splash.component.scss'],
})
export class SplashComponent implements OnInit {

  svgs: string[] = [];

  constructor(
    private http: HttpClient
  ) {
    // this.http.get(environment.staticUrl + '/phunk1069.svg', { responseType: 'text' }).pipe(
    //   switchMap((data) => from(svgson.parse(data))),
    //   map((data) => this.stripColors(data)),
    //   map((data) => this.convertToBase64(data))
    // ).subscribe((data) => {
    //   this.svg = data;
    // });
  }

  ngOnInit(): void {
    const numbers = this.getRandomNumbers();

    // Create an observable array to fetch all images
    const observables = numbers.map(number => {
      const url = `${environment.staticUrl}/phunk${number}.svg`;
      return this.http.get(url, { responseType: 'text' }).pipe(
        switchMap(data => from(svgson.parse(data))),
        map(data => this.stripColors(data)),
        map(data => this.convertToBase64(data))
      );
    });

    // Use forkJoin to handle all observables
    forkJoin(observables).pipe(
      tap((data: string[]) => this.svgs = data)
    ).subscribe();
  }

  stripColors(node: INode): INode {
    for (const child of node.children) {
      if (child.name === 'rect' && child.attributes?.fill) {

        const color = tinycolor(child.attributes.fill);
        const alpha = tinycolor(color).getBrightness() / 255;
        const opaque = tinycolor({ r: 0, g: 0, b: 0, a: alpha / 1.2 });

        const filter = ['#dbb180ff', '#ead9d9ff', '#7da269ff', '#352410ff', '#c8fbfbff', '#ae8b61ff', '#713f1dff'];

        if (filter.indexOf(child.attributes.fill) > -1) child.attributes.fill = '#00000000';
        else if (child.attributes.fill === '#000000ff') child.attributes.fill = '#000000ff';
        else if (alpha < 0.1) child.attributes.fill = '#000000ff';
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

}
