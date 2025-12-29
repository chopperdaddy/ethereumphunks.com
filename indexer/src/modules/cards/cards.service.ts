import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { StorageService } from '@/modules/storage/storage.service';
import { ImageService } from './services/image.service';
import { Web3Service } from '@/modules/shared/services/web3.service';
import { AppConfigService } from '@/config/config.service';
import { rarityData } from '@/modules/notifs/constants/rarity';

/**
 * Service for generating social share HTML cards
 */
@Injectable()
export class CardsService implements OnModuleInit {

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3Svc: Web3Service,
    private readonly imgSvc: ImageService,
    private readonly storageSvc: StorageService,
    private readonly configSvc: AppConfigService
  ) {}

  async onModuleInit() {
    // Test card generation after module initialization
    await this.generateEthscriptionCard('0x35b1e4f43177b7a3fe1029d93ebc44b16bbf3f7fe94d01242cc45278d26fffae');
  }

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
      let imageUrl = 'https://ethereumphunks.com/default-nft.png';
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

        // Convert to base64 data URL for embedding
        imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      } catch (error) {
        console.error('Failed to generate social share image:', error);
        // Fallback to direct image URL
        imageUrl = ethscription.sha
          ? `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/images/${ethscription.sha}.png`
          : 'https://ethereumphunks.com/default-nft.png';
      }

      // Extract name from attributes or use token ID
      const nameAttr = attributes?.values?.['Name'] || attributes?.values?.['name'];
      const name = nameAttr
        ? (Array.isArray(nameAttr) ? nameAttr[0] : nameAttr)
        : `${collection?.singleName || 'Item'} #${ethscription.tokenId || hashId.slice(0, 8)}`;

      // Extract description from attributes or use default
      const descAttr = attributes?.values?.['Description'] || attributes?.values?.['description'];
      const description = descAttr
        ? (Array.isArray(descAttr) ? descAttr[0] : descAttr)
        : `A unique digital collectible from the ${collection?.name || 'Unknown'} collection.`;

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
      let imageUrl = 'https://ethereumphunks.com/default-collection.png';
      try {
        // Fetch random preview items for the collection
        const previewItems = collection.previews;
        const imageBuffer = await this.imgSvc.generateCollectionSocialImage(collection, previewItems);
        // Convert to base64 data URL for embedding
        imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      } catch (error) {
        console.error('Failed to generate collection social share image:', error);
        // Fallback to poster image or default
        imageUrl = collection.image || collection.posterHashId
          ? `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/images/${collection.posterHashId}.png`
          : 'https://ethereumphunks.com/default-collection.png';
      }

      return this.generateSocialHtml({
        title: collection.name,
        description: collection.description || `Explore the ${collection.name} collection with ${collection.supply} unique digital collectibles.`,
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

  // /**
  //  * Generate HTML with meta tags for a collection market page
  //  * @param slug The collection slug
  //  * @param marketType The market type
  //  * @returns HTML string with proper meta tags
  //  */
  // async generateCollectionMarketCard(slug: string, marketType: string): Promise<string> {
  //   try {
  //     const collection = await this.storageSvc.fetchCollection(slug);

  //     if (!collection) {
  //       return this.generateFallbackHtml('market', { slug, marketType });
  //     }

  //     // Generate custom collection market social share image
  //     let imageUrl = 'https://ethereumphunks.com/default-collection.png';
  //     try {
  //       // Fetch random preview items for the collection
  //       const previewItems = await this.storageSvc.fetchRandomEthscriptions(slug, 4);
  //       const imageBuffer = await this.imgSvc.generateCollectionSocialImage(collection, previewItems);
  //       // Convert to base64 data URL for embedding
  //       imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
  //     } catch (error) {
  //       console.error('Failed to generate collection market social share image:', error);
  //       // Fallback to poster image or default
  //       imageUrl = collection.image || collection.posterHashId
  //         ? `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/images/${collection.posterHashId}.png`
  //         : 'https://ethereumphunks.com/default-collection.png';
  //     }

  //     const marketTypeTitle = marketType.charAt(0).toUpperCase() + marketType.slice(1);

  //     return this.generateSocialHtml({
  //       title: `${collection.name} ${marketTypeTitle}`,
  //       description: `Browse ${marketType} in the ${collection.name} collection. ${collection.supply} unique digital collectibles.`,
  //       image: imageUrl,
  //       url: `/${slug}/market/${marketType}`,
  //       siteName: 'EtherPhunks',
  //       redirectUrl: `https://etherphunks.eth.limo/${slug}/market/${marketType}`
  //     });

  //   } catch (error) {
  //     console.error('Error generating collection market card:', error);
  //     return this.generateFallbackHtml('market', { slug, marketType });
  //   }
  // }

  /**
   * Generate the actual HTML with meta tags
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
  <meta property="og:url" content="https://ethereumphunks.com${data.url}">
  <meta property="og:title" content="${data.title}">
  <meta property="og:description" content="${data.description}">
  <meta property="og:image" content="${data.image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${data.siteName}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://ethereumphunks.com${data.url}">
  <meta property="twitter:title" content="${data.title}">
  <meta property="twitter:description" content="${data.description}">
  <meta property="twitter:image" content="${data.image}">
  <meta property="twitter:site" content="@ethereumphunks">

  <!-- Discord -->
  <meta name="theme-color" content="#C3FF00">

  <!-- Auto-redirect to eth.limo after 1 second -->
  <meta http-equiv="refresh" content="1;url=${data.redirectUrl}">

  <style>
    body {
      font-family: 'Arial', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #C3FF00 0%, #FF03B4 100%);
      color: #000;
      text-align: center;
    }
    .container {
      max-width: 400px;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
    }
    .logo {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1rem;
    }
    .message {
      margin-bottom: 1.5rem;
      opacity: 0.9;
    }
    .spinner {
      border: 3px solid rgba(0, 0, 0, 0.3);
      border-radius: 50%;
      border-top: 3px solid #000;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    a {
      color: #000;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">EtherPhunks</div>
    <div class="message">Redirecting to ${data.title}...</div>
    <div class="spinner"></div>
    <p style="margin-top: 2rem; font-size: 0.9rem; opacity: 0.8;">
      If not redirected automatically,
      <a href="${data.redirectUrl}">click here</a>
    </p>
  </div>

  <script>
    // Fallback redirect in case meta refresh doesn't work
    setTimeout(() => {
      window.location.href = '${data.redirectUrl}';
    }, 1000);
  </script>
</body>
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
      image: 'https://ethereumphunks.com/default-share.png',
      url: '/',
      siteName: 'EtherPhunks',
      redirectUrl
    });
  }
}
