/**
 * Image Generator for Social Share Cards
 *
 * Generates SVG images for social media sharing cards
 */

export interface Ethscription {
	hashId: string;
	tokenId: number | null;
	slug: string | null;
	sha: string;
	owner: string | null;
	creator: string | null;
}

export interface Collection {
	slug: string;
	name: string;
	singleName?: string;
	description?: string;
	image?: string;
	supply: number;
}

const IMAGE_BASE_URL = 'https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/images';

/**
 * Generate social share card image (SVG) for ethscription
 */
export async function generateSocialCardImageSVG(data: {
	ethscription: Ethscription;
	collection: Collection;
}): Promise<string> {
	const canvasWidth = 1200;
	const canvasHeight = 630;
	const tokenId = data.ethscription.tokenId !== null ? `#${data.ethscription.tokenId}` : '';
	const collectionName = data.collection.singleName || data.collection.name || 'EtherPhunk';

	// Get NFT image URL
	const nftImageUrl = data.ethscription.sha
		? `${IMAGE_BASE_URL}/${data.ethscription.sha}.png`
		: null;

	// Generate SVG
	const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#C3FF00;stop-opacity:1" />
			<stop offset="100%" style="stop-color:#FF03B4;stop-opacity:1" />
		</linearGradient>
	</defs>

	<!-- Background -->
	<rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#bg)"/>

	<!-- Top bar -->
	<rect width="${canvasWidth}" height="20" fill="#FF03B4"/>

	<!-- Bottom bar -->
	<rect y="${canvasHeight - 200}" width="${canvasWidth}" height="200" fill="#FF03B4"/>

	<!-- Collection name -->
	<text x="25" y="${canvasHeight - 135}" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#C3FF00">${escapeSvgText(collectionName)}</text>

	<!-- Token ID -->
	<text x="20" y="${canvasHeight - 35}" font-family="Arial, sans-serif" font-size="100" font-weight="bold" fill="#C3FF00">${escapeSvgText(tokenId)}</text>

	<!-- NFT Image (if available) -->
	${nftImageUrl ? `<image href="${nftImageUrl}" x="${canvasWidth / 4}" y="${canvasHeight - 430}" width="${canvasWidth / 2}" height="${canvasHeight / 2}" preserveAspectRatio="xMidYMid meet"/>` : ''}

	<!-- Logo placeholder (we'll use text for now) -->
	<text x="40" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#000">EtherPhunks</text>
</svg>`;

	return svg;
}

/**
 * Generate social share card image SVG for collection
 */
export async function generateCollectionCardImageSVG(collection: Collection): Promise<string> {
	const canvasWidth = 1200;
	const canvasHeight = 630;

	const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#C3FF00;stop-opacity:1" />
			<stop offset="100%" style="stop-color:#FF03B4;stop-opacity:1" />
		</linearGradient>
	</defs>

	<!-- Background -->
	<rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#bg)"/>

	<!-- Collection image if available -->
	${collection.image ? `<image href="${collection.image}" x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" preserveAspectRatio="xMidYMid cover" opacity="0.3"/>` : ''}

	<!-- Collection name -->
	<text x="${canvasWidth / 2}" y="${canvasHeight / 2}" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#000" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(collection.name)}</text>

	<!-- Logo -->
	<text x="40" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#000">EtherPhunks</text>
</svg>`;

	return svg;
}

/**
 * Generate social share card image SVG for market
 */
export async function generateMarketCardImageSVG(collection: Collection, marketType: string): Promise<string> {
	const canvasWidth = 1200;
	const canvasHeight = 630;
	const marketTypeLabel = marketType.charAt(0).toUpperCase() + marketType.slice(1);

	const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#C3FF00;stop-opacity:1" />
			<stop offset="100%" style="stop-color:#FF03B4;stop-opacity:1" />
		</linearGradient>
	</defs>

	<!-- Background -->
	<rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#bg)"/>

	<!-- Market type -->
	<text x="${canvasWidth / 2}" y="${canvasHeight / 2 - 50}" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#000" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(marketTypeLabel)}</text>

	<!-- Collection name -->
	<text x="${canvasWidth / 2}" y="${canvasHeight / 2 + 50}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#000" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(collection.name)}</text>

	<!-- Logo -->
	<text x="40" y="100" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#000">EtherPhunks</text>
</svg>`;

	return svg;
}

/**
 * Escape text for use in SVG
 */
function escapeSvgText(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
