import { Injectable } from '@angular/core';

import { INode, stringify } from 'svgson';
import tinycolor from 'tinycolor2';
import * as UPNG from 'upng-js';

import { ColorService } from './color.service';

@Injectable({
  providedIn: 'root'
})
export class PixelArtService {

  constructor(private colorSvc: ColorService) {}

  /**
   * Processes a pixel art image and converts it to a 2D array of colors
   * @param buffer ArrayBuffer of the image
   * @returns Promise resolving to a 2D array of colors
   */
  public async processPixelArtImage(buffer: ArrayBuffer): Promise<string[][]> {
    try {
      // Decode PNG using UPNG (browser-compatible)
      const png = UPNG.decode(buffer);

      // Convert UPNG data to our format
      const pixelArtData = this.convertUpngToPixelArtFormat(png);
      return pixelArtData;
    } catch (error) {
      throw new Error(`PNG processing failed: ${error}`);
    }
  }

  /**
   * Converts UPNG data directly to a 2D array of colors (no canvas involved)
   * @param png PNG data from UPNG
   * @returns 2D array of colors
   */
  private convertUpngToPixelArtFormat(png: any): string[][] {
    const { width, height, data, ctype } = png;
    const pixelArtData: string[][] = [];

    // UPNG.decode returns compressed data, we need to convert to RGBA first
    // Convert to RGBA format using UPNG.toRGBA8
    const rgbaBuffer = UPNG.toRGBA8(png);
    const rgbaData = new Uint8Array(rgbaBuffer[0]); // First frame for static images

    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const r = rgbaData[index];
        const g = rgbaData[index + 1];
        const b = rgbaData[index + 2];
        const a = rgbaData[index + 3];

        const colorCode = this.colorSvc.rgbaToHex(r, g, b, a);
        row.push(colorCode);
      }
      pixelArtData.push(row);
    }

    return pixelArtData;
  }

  /**
   * Strips colors from a SVG node based on predefined filters
   * @param node SVG node to process
   * @returns Processed SVG node with colors stripped
   */
  stripColors(node: INode, slug: string): INode {
    const colorMap: Record<string, number> = {};

    // Get image dimensions from viewBox attribute
    const viewBox = node.attributes?.viewBox?.split(' ') || [];
    const width = parseInt(viewBox[2]) || 0;
    const height = parseInt(viewBox[3]) || 0;

    let removable: string[] = [];
    if (slug === 'unpunks') {
      removable = [...new Set(node.children
        .map((child) => child.attributes.fill)
        .filter((fill) => fill.startsWith('#c') || fill.startsWith('#bb') || fill.startsWith('#ba') || fill.startsWith('#bd') || fill.startsWith('#be') || fill.startsWith('#bc') || fill.startsWith('#bf')))];
    }

    const backgroundColors = node.children.filter((child) => child.attributes.x === '0');
    const filters = [
      ...new Set(backgroundColors.map((child) => child.attributes.fill)),
      ...[
        // Phunks
        '#ffffffff', // White
        '#ead9d9ff', // Albino Skin Tone
        '#dbb180ff', // Light Skin Tone
        '#ae8b61ff', // Mid Skin Tone
        '#713f1dff', // Dark Skin Tone
        '#7da269ff', // Zombie Skin Tone
        '#352410ff', // Ape Skin Tone
        '#c8fbfbff', // Alien Skin Tone

        // Dystophunks
        '#dbb180ff', // Light Skin Tone
        '#ead9d9ff', // Pink
        '#73aa57ff', // Zombie Skin Tone
        '#cba68cff', // Skin Tone
        '#c3ff01ff', // Yellow/Green

        // Mingos
        '#79a4f9ff', // Mingos background
        '#78a4f9ff', // Mingos background
        '#78a4f8ff', // Mingos background
        '#79a5f8ff', // Mingos background
        '#78a5f9ff', // Mingos background
        '#78a5f8ff', // Mingos background
        '#79a4f8ff', // Mingos background
        '#79a5f9ff', // Mingos background
        '#648596ff', // Mingos background

        // Unpunks
        ...removable,
      ]
    ];
    // console.log({width, height, backgroundColors, filters});

    for (const child of node.children) {
      if (child.name === 'rect' && child.attributes?.fill) {
        const color = tinycolor(child.attributes.fill);
        const brightness = tinycolor(color).getBrightness();
        const alpha = (brightness / 255);
        const opaque = tinycolor({ r: 0, g: 0, b: 0, a: (1 - alpha) });

        colorMap[child.attributes.fill] = (colorMap[child.attributes.fill] || 0) + 1;

        // Remove Skin Tone
        if (filters.indexOf(child.attributes.fill) > -1) child.attributes.fill = '#00000000';
        // Remove Transparent
        else if (child.attributes.fill === '#000000ff') continue;
        else child.attributes.fill = opaque.toString('hex8');
      }
    }

    // console.log(colorMap);
    return node;

    // // Display colors with visual styling
    // removable.forEach(color => {
    //   console.log(`%c${color}`, `background-color: ${color}; color: black; padding: 2px 8px; border-radius: 4px;`);
    // });

    // Or display all at once (simpler approach)
    // console.log('Removable colors:');
    // removable.forEach(color => {
    //   console.log(`%c ${color} `, `background-color: ${color}; color: black; padding: 2px 8px; border-radius: 4px; margin: 2px; display: inline-block;`);
    // });
  }

  /**
   * Converts a 2D array of colors to an SVG node
   * @param arr 2D array of colors
   * @returns SVG node
   */
  convertToSvg(arr: string[][]): INode {
    const width = arr[0].length;
    const height = arr.length;

    const svg: INode = {
      name: 'svg',
      type: 'element',
      attributes: {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: `0 0 ${width} ${height}`,
        width: `${width}`,
        height: `${height}`,
      },
      children: [],
      value: ''
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = arr[y][x];
        if (color === '00000000') continue;

        // console.log({x, y, width, height, color});
        const rect: INode = {
          name: 'rect',
          type: 'element',
          attributes: {
            x: `${x}`,
            y: `${y}`,
            width: '1',
            height: '1',
            fill: `#${color}`,
            'shape-rendering': 'crispEdges',
          },
          children: [],
          value: ''
        };
        svg.children.push(rect);
      }
    }

    return svg;
  }

  /**
   * Converts an SVG node to a Base64 string
   * @param node SVG node
   * @returns Base64 string
   */
  convertToBase64(node: INode): string {
    const string = stringify(node);
    const base64 = btoa(string);
    return `data:image/svg+xml;base64,${base64}`;
  }
}
