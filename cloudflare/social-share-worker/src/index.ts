/**
 * EtherPhunks Social Share Worker
 *
 * This worker detects social media crawlers and serves dynamic meta tags
 * for NFT pages, while redirecting regular users to the eth.limo domain.
 */

interface NFTMetadata {
	id: string;
	name: string;
	description: string;
	image: string;
	collection?: string;
}

// Social media crawler user agents
const SOCIAL_CRAWLERS = [
	'facebookexternalhit',
	'twitterbot',
	'linkedinbot',
	'discordbot',
	'telegrambot',
	'whatsapp',
	'slackbot',
	'redditbot',
	'skype',
	'snapchat',
	'pinterest',
	'googlebot',
	'bingbot'
];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';

		// Check if this is a social media crawler
		const isCrawler = SOCIAL_CRAWLERS.some(crawler => userAgent.includes(crawler));

		// Extract route information based on actual Angular routes
		const routeInfo = extractRouteInfo(url.pathname);

		if (isCrawler && routeInfo.type) {
			// Fetch HTML from NestJS API for social crawlers
			return fetchCardFromAPI(routeInfo);
		} else if (routeInfo.type) {
			// Redirect regular users to eth.limo with the same path
			return Response.redirect(`https://etherphunks.eth.limo${url.pathname}`, 302);
		}

		// For unknown paths, redirect to main eth.limo site
		return Response.redirect('https://etherphunks.eth.limo/', 302);
	},
} satisfies ExportedHandler<Env>;

/**
 * Extract hash ID from URL pathname based on actual Angular routes
 * Supports patterns like:
 * - /details/hashId (main item view route)
 * - /slug/market/marketType (collection market routes)
 * - /admin (admin dashboard)
 * - /slug (collection index)
 */
function extractRouteInfo(pathname: string): { type: 'details' | 'market' | 'collection' | 'admin' | 'home' | null, params: any } {
	// Remove leading slash for easier matching
	const path = pathname.slice(1);
	const segments = path.split('/');

	// /details/hashId - main item view
	if (segments.length === 2 && segments[0] === 'details') {
		return {
			type: 'details',
			params: { hashId: segments[1] }
		};
	}

	// /admin
	if (segments.length === 1 && segments[0] === 'admin') {
		return {
			type: 'admin',
			params: {}
		};
	}

	// /slug/market/marketType - collection market
	if (segments.length === 3 && segments[1] === 'market') {
		return {
			type: 'market',
			params: {
				slug: segments[0],
				marketType: segments[2]
			}
		};
	}

	// /slug - collection index (single segment, not admin)
	if (segments.length === 1 && segments[0] !== 'admin' && segments[0] !== '') {
		return {
			type: 'collection',
			params: { slug: segments[0] }
		};
	}

	// Root path
	if (segments.length === 1 && segments[0] === '') {
		return {
			type: 'home',
			params: {}
		};
	}

	return { type: null, params: {} };
}

/**
 * Get the original route URL from route info
 */
function getRouteUrl(routeInfo: { type: string, params: any }): string {
	switch (routeInfo.type) {
		case 'details':
			return `/details/${routeInfo.params.hashId}`;
		case 'collection':
			return `/${routeInfo.params.slug}`;
		case 'market':
			return `/${routeInfo.params.slug}/market/${routeInfo.params.marketType}`;
		case 'admin':
			return '/admin';
		case 'home':
			return '/';
		default:
			return '/';
	}
}

/**
 * Fetch HTML card from NestJS API
 */
async function fetchCardFromAPI(routeInfo: { type: string, params: any }): Promise<Response> {
	try {
		let apiUrl: string;

		switch (routeInfo.type) {
			case 'details':
				apiUrl = `https://relay.ethereumphunks.com/cards/ethscription/${routeInfo.params.hashId}`;
				break;
			case 'collection':
				apiUrl = `https://relay.ethereumphunks.com/cards/collection/${routeInfo.params.slug}`;
				break;
			case 'market':
				apiUrl = `https://relay.ethereumphunks.com/cards/collection/${routeInfo.params.slug}/market/${routeInfo.params.marketType}`;
				break;
			default:
				return generateFallbackHTML(routeInfo);
		}

		const response = await fetch(apiUrl, {
			headers: {
				'User-Agent': 'EtherPhunks-Social-Worker/1.0'
			}
		});

		if (response.ok) {
			const html = await response.text();
			return new Response(html, {
				headers: {
					'content-type': 'text/html;charset=UTF-8',
					'cache-control': 'public, max-age=300', // 5 minute cache
				},
			});
		} else {
			console.error(`API returned ${response.status} for ${apiUrl}`);
			return generateFallbackHTML(routeInfo);
		}

	} catch (error) {
		console.error('Error fetching card from API:', error);
		return generateFallbackHTML(routeInfo);
	}
}

/**
 * Generate fallback HTML when API is unavailable
 */
function generateFallbackHTML(routeInfo: { type: string, params: any }): Response {
	let title = 'EtherPhunks';
	let description = 'Discover unique digital collectibles on the EtherPhunks marketplace.';
	let redirectUrl = 'https://etherphunks.eth.limo/';

	switch (routeInfo.type) {
		case 'details':
			title = `Digital Collectible | EtherPhunks`;
			description = `Discover this unique digital collectible on EtherPhunks marketplace.`;
			redirectUrl = `https://etherphunks.eth.limo/details/${routeInfo.params.hashId}`;
			break;
		case 'collection':
			title = `${routeInfo.params.slug} Collection | EtherPhunks`;
			description = `Explore the ${routeInfo.params.slug} collection on EtherPhunks marketplace.`;
			redirectUrl = `https://etherphunks.eth.limo/${routeInfo.params.slug}`;
			break;
		case 'market':
			title = `${routeInfo.params.slug} ${routeInfo.params.marketType} | EtherPhunks`;
			description = `Browse ${routeInfo.params.marketType} in the ${routeInfo.params.slug} collection.`;
			redirectUrl = `https://etherphunks.eth.limo/${routeInfo.params.slug}/market/${routeInfo.params.marketType}`;
			break;
	}

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website">
	<meta property="og:url" content="https://ethereumphunks.com${getRouteUrl(routeInfo)}">
	<meta property="og:title" content="${title}">
	<meta property="og:description" content="${description}">
	<meta property="og:image" content="https://ethereumphunks.com/default-share.png">
	<meta property="og:site_name" content="EtherPhunks">

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image">
	<meta property="twitter:url" content="https://ethereumphunks.com${getRouteUrl(routeInfo)}">
	<meta property="twitter:title" content="${title}">
	<meta property="twitter:description" content="${description}">
	<meta property="twitter:image" content="https://ethereumphunks.com/default-share.png">
	<meta property="twitter:site" content="@ethereumphunks">

	<!-- Discord -->
	<meta name="theme-color" content="#C3FF00">

	<meta http-equiv="refresh" content="1;url=${redirectUrl}">

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
		<div class="message">Redirecting to marketplace...</div>
		<div class="spinner"></div>
		<p style="margin-top: 2rem; font-size: 0.9rem; opacity: 0.8;">
			If not redirected automatically,
			<a href="${redirectUrl}">click here</a>
		</p>
	</div>

	<script>
		setTimeout(() => {
			window.location.href = '${redirectUrl}';
		}, 1000);
	</script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'content-type': 'text/html;charset=UTF-8',
			'cache-control': 'public, max-age=60',
		},
	});
}
