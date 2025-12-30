import { Injectable, OnModuleInit } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { ImageService } from './services/image.service';
import { rarityData } from '@/modules/notifs/constants/rarity';

@Injectable()
export class CardsService implements OnModuleInit {

  constructor(
    private readonly imgSvc: ImageService,
    private readonly storageSvc: StorageService,
  ) {}

  async onModuleInit() {}

  /**
   * Generate HTML with meta tags for an ethscription
   * @param hashId The transaction hash ID
   * @returns HTML string with proper meta tags
   */
  async generateEthscriptionCard(hashId: string): Promise<string> {
    try {
      // Fetch ethscription data with collection info
      const data = await this.storageSvc.getEthscriptionWithCollectionAndAttributes(hashId);

      if (!data) {
        return this.generateFallbackHtml('ethscription', { hashId });
      }

      const { ethscription, collection, attributes } = data;

      // Generate custom social share image
      let imageUrl = 'https://etherphunks.eth.limo/poster.png';
      try {
        // Transform attributes to match expected format with proper rarity calculation
        const transformedAttributes = Object.keys(attributes.values).map((attrKey: string) => {
          const v = Array.isArray(attributes.values[attrKey])
            ? attributes.values[attrKey][0]
            : attributes.values[attrKey];

          // Calculate rarity from rarityData (same as notifs module)
          const rarity = rarityData[ethscription.slug]?.[v] || Infinity;

          return {
            k: attrKey,
            v,
            rarity
          };
        }).sort((a, b) => (a.rarity || Infinity) - (b.rarity || Infinity)); // Sort by rarity, rarest first

        const imageBuffer = await this.imgSvc.generateSocialShareImage({
          ethscription,
          collection,
          attributes: transformedAttributes
        });

        // Upload image to storage and get public URL
        const socialImageFilename = `details-${hashId}.png`;
        await this.storageSvc.uploadImage(
          imageBuffer,
          socialImageFilename,
          'png',
          ethscription.slug
        );

        // Use public URL instead of data URI for better social media crawler support
        imageUrl = `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/static/cards/${socialImageFilename}`;
      } catch (error) {
        console.error('Failed to generate social share image:', error);
        imageUrl = 'https://etherphunks.eth.limo/poster.png';
      }

      // Extract name from attributes or use token ID
      const nameAttr = attributes?.values?.['Name'] || attributes?.values?.['name'];
      const name = nameAttr
        ? (Array.isArray(nameAttr) ? nameAttr[0] : nameAttr)
        : `${collection?.singleName || 'Item'} #${ethscription.tokenId || hashId.slice(0, 8)}`;

      // Extract description from attributes or use default
      const descAttr = attributes?.values?.['Description'] || attributes?.values?.['description'];
      const description = 'Ethereum Phunks Market 👍';

      return this.generateSocialHtml({
        title: name,
        description,
        image: imageUrl,
        url: `/details/${hashId}`,
        siteName: 'EtherPhunks',
        redirectUrl: `https://etherphunks.eth.limo/details/${hashId}`
      });

    } catch (error) {
      console.error('Error generating ethscription card:', error);
      return this.generateFallbackHtml('ethscription', { hashId });
    }
  }

  /**
   * Generate HTML with meta tags for a collection
   * @param slug The collection slug
   * @returns HTML string with proper meta tags
   */
  async generateCollectionCard(slug: string): Promise<string> {
    try {
      const collections = await this.storageSvc.fetchCollectionsWithPreviews();
      const collection = (collections.find((c) => c.ethscription.slug === slug)).ethscription;

      if (!collection) {
        return this.generateFallbackHtml('collection', { slug });
      }

      // Generate custom collection social share image
      let imageUrl = 'https://etherphunks.eth.limo/poster.png';
      try {
        // Fetch random preview items for the collection
        const previewItems = collection.previews;
        const imageBuffer = await this.imgSvc.generateCollectionSocialImage(collection, previewItems);

        // Upload image to storage and get public URL
        const socialImageFilename = `collection-${slug}.png`;
        await this.storageSvc.uploadImage(
          imageBuffer,
          socialImageFilename,
          'png',
          slug
        );

        // Use public URL instead of data URI for better social media crawler support
        imageUrl = `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/static/cards/${socialImageFilename}`;
      } catch (error) {
        console.error('Failed to generate collection social share image:', error);
        // Fallback to poster image or default
        imageUrl = 'https://etherphunks.eth.limo/poster.png';
      }

      return this.generateSocialHtml({
        title: collection.name,
        description: 'Ethereum Phunks Market 👍',
        image: imageUrl,
        url: `/${slug}`,
        siteName: 'EtherPhunks',
        redirectUrl: `https://etherphunks.eth.limo/${slug}`
      });

    } catch (error) {
      console.error('Error generating collection card:', error);
      return this.generateFallbackHtml('collection', { slug });
    }
  }

  /**
   * Generate the actual HTML with meta tags
   * Simplified for crawlers - they only need meta tags, not redirect UI
   */
  private generateSocialHtml(data: {
    title: string;
    description: string;
    image: string;
    url: string;
    siteName: string;
    redirectUrl: string;
  }): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} | ${data.siteName}</title>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://etherphunks.eth.limo${data.url}">
  <meta property="og:title" content="${data.title}">
  <meta property="og:description" content="${data.description}">
  <meta property="og:image" content="${data.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${data.siteName}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://etherphunks.eth.limo${data.url}">
  <meta property="twitter:title" content="${data.title}">
  <meta property="twitter:description" content="${data.description}">
  <meta property="twitter:image" content="${data.image}">
  <meta property="twitter:site" content="@ethereumphunks">

  <!-- Discord -->
  <meta name="theme-color" content="#C3FF00">
</head>
<body></body>
</html>`;
  }

  /**
   * Generate fallback HTML when data is not available
   */
  private generateFallbackHtml(type: string, params: any): string {
    let title = 'EtherPhunks';
    let description = 'Discover unique digital collectibles on the EtherPhunks marketplace.';
    let redirectUrl = 'https://etherphunks.eth.limo/';

    switch (type) {
      case 'ethscription':
        title = `Digital Collectible | EtherPhunks`;
        description = `Discover this unique digital collectible on EtherPhunks marketplace.`;
        redirectUrl = `https://etherphunks.eth.limo/details/${params.hashId}`;
        break;
      case 'collection':
        title = `${params.slug} Collection | EtherPhunks`;
        description = `Explore the ${params.slug} collection on EtherPhunks marketplace.`;
        redirectUrl = `https://etherphunks.eth.limo/${params.slug}`;
        break;
      case 'market':
        title = `${params.slug} ${params.marketType} | EtherPhunks`;
        description = `Browse ${params.marketType} in the ${params.slug} collection.`;
        redirectUrl = `https://etherphunks.eth.limo/${params.slug}/market/${params.marketType}`;
        break;
    }

    return this.generateSocialHtml({
      title,
      description,
      image: 'https://etherphunks.eth.limo/poster.png',
      url: '/',
      siteName: 'EtherPhunks',
      redirectUrl
    });
  }
}
