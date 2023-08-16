import { Injectable, Logger } from '@nestjs/common';

import { Web3Service } from './web3.service';
import { SupabaseService } from './supabase.service';

import { readFile, writeFile } from 'fs/promises';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class EmblemService {
  constructor(
    private readonly ethSvc: Web3Service,
    private readonly sbSvc: SupabaseService
  ) {
    this.buildPhunkEthscriptionsJson();
  }

  async buildPhunkEthscriptionsJson(): Promise<void> {
    const inscriptions = [];
    const attributes = path.join(__dirname, `./_attributes.json`);
    const attributesJson = await readFile(attributes, 'utf8');
    const attributesObj = JSON.parse(attributesJson);

    for (let i = 0; i < 10000; i++) {
      try {
        const phunk = await this.sbSvc.getPhunkById(`${i}`);
        const id = phunk.hashId;

        const attributes = attributesObj[i]
          .filter((attr) => attr.k !== 'Skintone')
          .map((attr) => {
            return {
              trait_type: attr.k,
              value: attr.v,
            };
          });

        inscriptions.push({
          id,
          meta: {
            name: `EtherPhunk ${i}`,
            attributes,
          },
          number: i,
        });

        Logger.log(`Processed Phunk ${i}`);
      } catch (error) {
        i = i - 1;
        Logger.error(`Error processing Phunk ${i}`);
        console.log(error);
      }
    }

    const json = {
      name: 'Ethereum Phunks (EtherPhunks)',
      inscription_icon: '',
      supply: '10000',
      slug: 'ether-phunks',
      description:
        '10,000 Ethscription-crafted digital artifacts, honoring the original anti-corporate blockchain pioneers. Embrace the decentralized revolution. Be Phree. Be Phunky.',
      twitter_link: 'https://twitter.com/etherphunks',
      discord_link: '',
      website_link: 'https://ethereumphunks.com',
      background_color: '#C3FF00',
      inscriptions,
    };

    await writeFile('EthereumPhunks.json', JSON.stringify(json), 'utf8');
  }
}
