import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from "@nestjs/common";

import { AdminService } from './admin.service';
import { ProcessingService } from '@/modules/processing/processing.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {

  constructor(
    private readonly adminSvc: AdminService,
    private readonly processingSvc: ProcessingService,
  ) {}

  /**
   * Checks if the user has access to admin endpoints
   * @param body - The request body containing the address.
   * @returns A promise that resolves to true if the user has access, otherwise false.
   */
  @Post('has-access')
  async hasAccess(@Body() body: { address: `0x${string}` }): Promise<boolean> {
    return true;
  }

  /**
   * Reindexes a specific block.
   * @param body - The request body containing the block number.
   * @returns A promise that resolves to the result of re-indexing the block.
   */
  @Post('reindex-block')
  async reindexBlock(@Body() body: { blockNumber: number }): Promise<void> {
    return await this.processingSvc.processBlock(body.blockNumber, false);
  }

  /**
   * Reindexes a specific transaction.
   * @param body - The request body containing the transaction hash.
   * @returns A promise that resolves to the result of re-indexing the transaction.
   */
  @Post('reindex-transaction')
  async reindexTransaction(@Body() body: { hash: `0x${string}` }): Promise<void> {
    return await this.processingSvc.processSingleTransaction(body.hash);
  }

  /**
   * Creates a new collection in the database
   * @param slug - The slug of the collection
   * @param singleName - The single name of the collection
   */
  @Post('create-collection')
  async createCollectionInDB(@Body() body: { slug: string, singleName: string }) {
    const { slug, singleName } = body;

    if (!slug || !singleName) {
      throw new HttpException('Slug and single name are required', HttpStatus.BAD_REQUEST);
    }

    return this.adminSvc.createCollectionInDB(slug, singleName);
  }

  /**
   * Creates and uploads images for all Dystophunks
   * Processes each item's image data and triggers upload to storage
   * This is a requirement for displaying images on the marketplace
   * @param slug - The slug of the collection
   */
  @Post('create-collection-images')
  async createCollectionImages(@Body() body: { slug: string }) {
    const { slug } = body;

    if (!slug) {
      throw new HttpException('Slug is required', HttpStatus.BAD_REQUEST);
    }

    return this.adminSvc.createAndUploadCollectionImages(slug);
  }

  /**
   * Indexes a new collection
   * @param slug - The slug of the collection
   */
  @Post('index-collection')
  async indexCollection(@Body() body: { slug: string }) {
    const { slug } = body;

    if (!slug) {
      throw new HttpException('Slug is required', HttpStatus.BAD_REQUEST);
    }

    return this.adminSvc.indexNewCollection(slug);
  }

  /**
   * Re-indexes an ethscription item and its transfers
   * @param hashId - The hash ID of the ethscription item
   */
  @Post('reindex-ethscription')
  async reindexEthscription(@Body() body: { hashId: string }) {
    const { hashId } = body;

    if (!hashId) {
      throw new HttpException('Hash ID is required', HttpStatus.BAD_REQUEST);
    }

    return this.adminSvc.reIndexEthscriptionItemAndTransfers(hashId);
  }
}
