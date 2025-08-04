import { Controller, Post, Body, HttpException, HttpStatus, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";

import { CollectionAdminService } from './collection-admin.service';

@Controller('collection-admin')
@UseGuards(JwtAuthGuard)
export class CollectionAdminController {

  constructor(
    private readonly collectionAdminSvc: CollectionAdminService,
  ) {}

  /**
   * Generates collection metadata
   * @param slug - The slug of the collection
   * @param metadataUrl - The URL of the metadata file
   */
  @Post('generate-collection-metadata')
  async createCollection(@Body() body: { slug: string, metadataUrl: string }) {
    const { slug, metadataUrl } = body;

    if (!slug) {
      throw new HttpException('Slug is required', HttpStatus.BAD_REQUEST);
    }

    if (!metadataUrl) {
      return this.collectionAdminSvc.generateCollectionMetadataFromDB(slug);
    }

    return this.collectionAdminSvc.generateNewCollectionMetadata(slug, metadataUrl);
  }

  /**
   * Adds attributes to the database attributes_new table
   * This is a requirement for indexing collection items
   * @param slug - The slug of the collection
   */
  @Post('add-attributes-to-db')
  async addAttributes(@Body() body: { slug: string }) {
    const { slug } = body;

    if (!slug) {
      throw new HttpException('Slug is required', HttpStatus.BAD_REQUEST);
    }

    return this.collectionAdminSvc.addAttributesToDb(slug);
  }

  /**
   * Generates and uploads attributes filters for a collection
   * @param slug - The slug of the collection
   */
  @Post('add-filters-file')
  async addFilters(@Body() body: { slug: string }) {
    const { slug } = body;

    if (!slug) {
      throw new HttpException('Slug is required', HttpStatus.BAD_REQUEST);
    }

    return this.collectionAdminSvc.generateAttributesFiltersAndUpload(slug);
  }
}
