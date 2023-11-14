import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from '../services/web3.service';
import { SupabaseService } from '../services/supabase.service';

import * as svgson from 'svgson';
import * as crypto from 'crypto';

import { writeFile } from 'fs/promises';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class PhunkService {

  constructor(
    private readonly ethSvc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {}

  async getAllPunkData(start: number, end: number) {

    const skipped = [];

    for (let i = start; i < end; i++) {
      try {
        const img = await this.ethSvc.getPunkImage(i);
        const shaHash = await this.generateSHA256Hashes(img);
        await this.sbSvc.addSha(`${i}`, shaHash);
        Logger.log(`Added ${i} to Supabase`);
      } catch (err) {
        Logger.error(err.message);
        skipped.push(i);
      }
    }

    console.log(skipped);
    writeFile('skipped.json', JSON.stringify(skipped));
  }

  async generateSHA256Hashes(punkSVGData: string): Promise<any> {

    const rawSVG = punkSVGData.split('data:image/svg+xml;utf8,')[1];
    // Parse the SVG data to JSON
    const parsedSVG = await svgson.parse(rawSVG);

    // Flip the x coordinates
    parsedSVG.children.forEach(child => {
      if (child.name === 'rect') {
        let x = parseFloat(child.attributes.x);
        let width = parseFloat(child.attributes.width);
        let viewBoxWidth = parseFloat(parsedSVG.attributes.viewBox.split(' ')[2]);
        let newX = viewBoxWidth - (x + width);
        child.attributes.x = newX.toString();
      }
    });

    const serialized = svgson.stringify(parsedSVG);
    const ethscription = 'data:image/svg+xml,' + encodeURIComponent(serialized);

    const hash = crypto.createHash('sha256');
    hash.update(ethscription);
    const sha256Hash = hash.digest('hex');

    return sha256Hash;
  }

}
