/**
 * EtherPhunks Social Share Worker
 *
 * This worker detects social media crawlers and serves dynamic meta tags
 * for NFT pages, while redirecting regular users to the eth.limo domain.
 */

/**
 * Get API URL based on environment
 * In development (localhost), use local NestJS API
 * In production, use the relay API
 */
function getApiUrl(requestUrl: string): string {
	const url = new URL(requestUrl);
	// Check if we're running locally (localhost or 127.0.0.1)
	if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.includes('localhost')) {
		return 'http://localhost:3002';
	}
	return 'https://relay.ethereumphunks.com';
}

// Social media crawler user agents
// Note: Matching is case-insensitive (userAgent is lowercased)
const SOCIAL_CRAWLERS = [
	'facebookexternalhit',
	'twitterbot',           // Twitter/X official bot: "Mozilla/5.0 (compatible; Twitterbot/1.0)"
	'x-bot',                // X (Twitter) alternative
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
	'bingbot',
	// Common testing/preview tools
	'socialsharepreview',   // Social Share Preview tool
	'opengraph',            // Open Graph testing tools
	'metascraper',          // Meta scraper tools
];

// Social media referer patterns (these platforms use browser user-agents but can be identified by referer)
const SOCIAL_REFERERS = [
	't.co',              // Twitter/X link shortener
	'twitter.com',       // Twitter
	'x.com',             // X (Twitter)
	'facebook.com',      // Facebook
	'linkedin.com',     // LinkedIn
	'discord.com',       // Discord
	'telegram.org',     // Telegram
	'reddit.com',       // Reddit
];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
		const referer = request.headers.get('referer')?.toLowerCase() || '';

		// Check if this is a social media crawler or test mode
		// IMPORTANT: Only check user-agent for crawler detection, not referer
		// Regular users clicking links from social media will have social referers
		// but should be redirected, not served the HTML card
		const isTestMode = url.searchParams.has('test') || url.searchParams.has('preview');
		const matchesCrawlerPattern = SOCIAL_CRAWLERS.some(crawler => userAgent.includes(crawler));
		const isCrawler = matchesCrawlerPattern || isTestMode;

		// Extract route information based on actual Angular routes
		const routeInfo = extractRouteInfo(url.pathname);

		// Debug logging - always log user-agent for debugging crawler detection
		// This helps identify what user-agents testing tools are using
		if (isTestMode || (!isCrawler && routeInfo.type)) {
			const originalUserAgent = request.headers.get('user-agent') || 'missing';
			const originalReferer = request.headers.get('referer') || 'missing';
			console.log('Request details:', {
				pathname: url.pathname,
				routeType: routeInfo.type,
				isCrawler,
				isTestMode,
				matchesCrawlerPattern,
				userAgent: originalUserAgent,
				referer: originalReferer,
			});
		}

		// If crawler and we have a valid route, serve HTML card
		if (isCrawler && routeInfo.type) {
			const apiUrl = getApiUrl(request.url);
			return fetchCardFromAPI(routeInfo as { type: 'details' | 'collection', params: Record<string, string> }, isTestMode, apiUrl);
		}

		// All other requests (non-crawlers) should be redirected to eth.limo
		// Preserve the full pathname and query string
		const redirectUrl = `https://etherphunks.eth.limo${url.pathname}${url.search}`;
		return Response.redirect(redirectUrl, 302);
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
function extractRouteInfo(pathname: string): { type: 'details' | 'collection' | 'admin' | 'home' | null, params: Record<string, string> } {
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

	// /slug/market/marketType - collection market
	if (segments.length === 3 && segments[1] === 'market') {
		return {
			type: 'collection',
			params: {
				slug: segments[0],
				marketType: segments[2]
			}
		};
	}

	// /admin
	if (segments.length === 1 && segments[0] === 'admin') {
		return {
			type: 'admin',
			params: {}
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
 * Note: This is used in meta tags, so we don't encode here - encoding happens in escapeHtml
 */
function getRouteUrl(routeInfo: { type: string, params: Record<string, string> }): string {
	switch (routeInfo.type) {
		case 'details':
			return `/details/${routeInfo.params.hashId || ''}`;
		case 'collection':
			return `/${routeInfo.params.slug || ''}`;
		case 'admin':
			return '/admin';
		case 'home':
			return '/';
		default:
			return '/';
	}
}

/**
 * Validate hashId format (should be hex string, typically 66 chars with 0x prefix)
 */
function isValidHashId(hashId: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(hashId);
}

/**
 * Validate slug format (alphanumeric, hyphens, underscores only)
 */
function isValidSlug(slug: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(slug) && slug.length <= 100;
}

/**
 * Fetch HTML card from NestJS API
 */
async function fetchCardFromAPI(routeInfo: { type: string, params: Record<string, string> }, isTestMode: boolean = false, baseApiUrl: string = 'https://relay.ethereumphunks.com'): Promise<Response> {
	try {
		// Validate inputs before constructing URL
		if (routeInfo.type === 'details' && routeInfo.params.hashId) {
			if (!isValidHashId(routeInfo.params.hashId)) {
				console.warn(`Invalid hashId format: ${routeInfo.params.hashId}`);
				return generateFallbackHTML(routeInfo);
			}
		}
		if (routeInfo.type === 'collection' && routeInfo.params.slug) {
			if (!isValidSlug(routeInfo.params.slug)) {
				console.warn(`Invalid slug format: ${routeInfo.params.slug}`);
				return generateFallbackHTML(routeInfo);
			}
		}

		let apiUrl: string;

		switch (routeInfo.type) {
			case 'details':
				apiUrl = `${baseApiUrl}/cards/ethscription/${encodeURIComponent(routeInfo.params.hashId)}`;
				break;
			case 'collection':
				apiUrl = `${baseApiUrl}/cards/collection/${encodeURIComponent(routeInfo.params.slug)}`;
				break;
			default:
				return generateFallbackHTML(routeInfo);
		}

		// Add timeout to prevent hanging requests (Cloudflare Workers default is 30s, but we'll be explicit)
		// Note: setTimeout works in Cloudflare Workers, but we use AbortController for better control
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		try {
			const response = await fetch(apiUrl, {
				headers: {
					'User-Agent': 'EtherPhunks-Worker/1.0'
				},
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				console.error(`API returned ${response.status} for ${apiUrl}`);
				return generateFallbackHTML(routeInfo);
			}

			let html = await response.text();

			// Limit response size to prevent abuse (10MB max)
			if (html.length > 10 * 1024 * 1024) {
				console.error(`Response too large: ${html.length} bytes`);
				return generateFallbackHTML(routeInfo);
			}

			// Strip out redirect elements - crawlers only need meta tags, not redirects
			// Remove meta refresh redirects
			html = html.replace(/<meta\s+http-equiv=["']refresh["'][^>]*>/gi, '');
			// Remove JavaScript redirects (entire script tags with window.location)
			html = html.replace(/<script[^>]*>[\s\S]*?window\.location[\s\S]*?<\/script>/gi, '');
			// Remove setTimeout redirects
			html = html.replace(/setTimeout\s*\([^)]*window\.location[^)]*\)/gi, '');
			// Replace body content with empty body (crawlers don't render it anyway)
			html = html.replace(/<body[^>]*>[\s\S]*?<\/body>/i, '<body></body>');

			return new Response(html, {
				headers: {
					'content-type': 'text/html;charset=UTF-8',
					'cache-control': 'public, max-age=300', // 5 minute cache
					'x-content-type-options': 'nosniff',
					'x-frame-options': 'DENY',
				},
			});
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === 'AbortError') {
				console.error('Request timeout fetching card from API');
			} else {
				throw fetchError;
			}
			return generateFallbackHTML(routeInfo);
		}

	} catch (error) {
		console.error('Error fetching card from API:', error instanceof Error ? error.message : 'Unknown error');
		return generateFallbackHTML(routeInfo);
	}
}

/**
 * Generate fallback HTML when API is unavailable
 */
function generateFallbackHTML(routeInfo: { type: string, params: Record<string, string> }): Response {
	let title = 'Ethereum Phunks Market';
	let description = 'Ethereum Phunks Market 👍';

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website">
	<meta property="og:url" content="https://etherphunks.eth.limo${getRouteUrl(routeInfo)}">
	<meta property="og:title" content="${escapeHtml(title)}">
	<meta property="og:description" content="${escapeHtml(description)}">
	<meta property="og:image" content="https://etherphunks.eth.limo/poster.png">
	<meta property="og:site_name" content="EtherPhunks">

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:url" content="https://etherphunks.eth.limo${getRouteUrl(routeInfo)}">
	<meta name="twitter:title" content="${escapeHtml(title)}">
	<meta name="twitter:description" content="${escapeHtml(description)}">
	<meta name="twitter:image" content="https://etherphunks.eth.limo/poster.png">
	<meta name="twitter:site" content="@ethereumphunks">

	<!-- Discord -->
	<meta name="theme-color" content="#C3FF00">
</head>
<body></body>
</html>`;

	return new Response(html, {
		headers: {
			'content-type': 'text/html;charset=UTF-8',
			'cache-control': 'public, max-age=60',
			'x-content-type-options': 'nosniff',
			'x-frame-options': 'DENY',
		},
	});
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}
