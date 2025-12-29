import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';

import { CardsService } from './cards.service';

@Controller('cards')
export class CardsController {

  constructor(
    private readonly cardsSvc: CardsService
  ) {}

  /**
   * Generate social share HTML for an ethscription details page
   * @param hashId The transaction hash ID
   * @returns HTML with proper meta tags
   */
  @Get('ethscription/:hashId')
  async getEthscriptionCard(@Param('hashId') hashId: string, @Res() res: Response): Promise<void> {
    const html = await this.cardsSvc.generateEthscriptionCard(hashId);
    res.setHeader('content-type', 'text/html');
    res.setHeader('cache-control', 'public, max-age=300'); // 5 minute cache
    res.send(html);
  }

  /**
   * Generate social share HTML for a collection page
   * @param slug The collection slug
   * @returns HTML with proper meta tags
   */
  @Get('collection/:slug')
  async getCollectionCard(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const html = await this.cardsSvc.generateCollectionCard(slug);
    res.setHeader('content-type', 'text/html');
    res.setHeader('cache-control', 'public, max-age=300'); // 5 minute cache
    res.send(html);
  }

  // /**
  //  * Generate social share HTML for a collection market page
  //  * @param slug The collection slug
  //  * @param marketType The market type (offers, sales, etc.)
  //  * @returns HTML with proper meta tags
  //  */
  // @Get('collection/:slug/market/:marketType')
  // async getCollectionMarketCard(
  //   @Param('slug') slug: string,
  //   @Param('marketType') marketType: string,
  //   @Res() res: Response
  // ): Promise<void> {
  //   const html = await this.cardsSvc.generateCollectionMarketCard(slug, marketType);
  //   res.setHeader('content-type', 'text/html');
  //   res.setHeader('cache-control', 'public, max-age=300'); // 5 minute cache
  //   res.send(html);
  // }
}
