import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';

import { filter, map, Observable, combineLatest, shareReplay, firstValueFrom } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import { selectWalletAddress } from '@/state/app/app-state.selectors';
import { environment } from '../../environments/environment';

export interface PageContext {
  type: 'item-view' | 'market' | 'collection' | 'admin' | 'unknown';
  route: string;
  params: Record<string, any>;
  queryParams: Record<string, any>;
  network: {
    chainId: number;
    name: 'mainnet' | 'sepolia';
    env: string;
  };
  data: {
    hashId?: string;
    marketType?: string;
    slug?: string;
    collection?: string;
    userAddress?: string;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class PageContextService {

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private store: Store<GlobalState>
  ) {}

  /**
   * Get current page context for including in chat messages
   */
  getCurrentPageContext(): Observable<PageContext> {
    return combineLatest([
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        map(() => this.extractRouteInfo())
      ),
      this.store.select(selectWalletAddress)
    ]).pipe(
      map(([routeInfo, userAddress]) => ({
        ...routeInfo,
        network: this.getNetworkInfo(),
        data: {
          ...routeInfo.data,
          userAddress: userAddress || undefined
        },
        timestamp: new Date().toISOString()
      })),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /**
   * Get current page context as a Promise (convenience method for async/await usage)
   */
  async getCurrentPageContextAsync(): Promise<PageContext> {
    // Get current route info immediately (no need to wait for navigation events)
    const routeInfo = this.extractRouteInfo();
    console.log('🛤️ Extracted route info:', routeInfo);

    // Get user address from store
    const userAddress = await firstValueFrom(this.store.select(selectWalletAddress));
    console.log('👛 User address from store:', userAddress);

    const networkInfo = this.getNetworkInfo();
    console.log('🌐 Network info:', networkInfo);

    const pageContext = {
      ...routeInfo,
      network: networkInfo,
      data: {
        ...routeInfo.data,
        userAddress: userAddress || undefined
      },
      timestamp: new Date().toISOString()
    };

    console.log('📄 Final page context:', pageContext);

    return pageContext;
  }

  /**
   * Extract route information from current navigation
   */
  private extractRouteInfo(): Omit<PageContext, 'timestamp'> {
    const url = this.router.url;
    console.log('🌐 Current URL:', url);

    const urlTree = this.router.parseUrl(url);
    console.log('🌳 URL tree:', urlTree);

    const primary = urlTree.root.children.primary;
    console.log('🎯 Primary route:', primary);

    if (!primary) {
      console.log('⚠️ No primary route found');
      return {
        type: 'unknown',
        route: url,
        params: {},
        queryParams: urlTree.queryParams,
        network: this.getNetworkInfo(),
        data: {}
      };
    }

    const segments = primary.segments.map(s => s.path);
    const params = this.extractParams(primary.segments);

    console.log('📍 Route segments:', segments);
    console.log('📄 Extracted params:', params);

    // Determine page type and extract relevant data
    if (segments[0] === 'details' && params.hashId) {
      return {
        type: 'item-view',
        route: url,
        params,
        queryParams: urlTree.queryParams,
        network: this.getNetworkInfo(),
        data: {
          hashId: params.hashId
        }
      };
    }

    if (segments.includes('market') && params.marketType) {
      const slug = segments[0] !== 'market' ? segments[0] : 'ethereum-phunks';
      return {
        type: 'market',
        route: url,
        params,
        queryParams: urlTree.queryParams,
        network: this.getNetworkInfo(),
        data: {
          marketType: params.marketType,
          slug,
          collection: slug
        }
      };
    }

    if (segments[0] === 'admin') {
      return {
        type: 'admin',
        route: url,
        params,
        queryParams: urlTree.queryParams,
        network: this.getNetworkInfo(),
        data: {}
      };
    }

    // Collection page (slug only)
    if (segments.length === 1 && segments[0] !== 'admin') {
      return {
        type: 'collection',
        route: url,
        params,
        queryParams: urlTree.queryParams,
        network: this.getNetworkInfo(),
        data: {
          slug: segments[0],
          collection: segments[0]
        }
      };
    }

    return {
      type: 'unknown',
      route: url,
      params,
      queryParams: urlTree.queryParams,
      network: this.getNetworkInfo(),
      data: {}
    };
  }

  /**
   * Extract parameters from route segments
   */
  private extractParams(segments: any[]): Record<string, any> {
    const params: Record<string, any> = {};

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Look for common parameter patterns
      if (segment.path === 'details' && segments[i + 1]) {
        params.hashId = segments[i + 1].path;
      }

      if (segment.path === 'market' && segments[i + 1]) {
        params.marketType = segments[i + 1].path;
      }

      // First segment could be a collection slug
      if (i === 0 && segment.path !== 'details' && segment.path !== 'admin') {
        params.slug = segment.path;
      }
    }

    return params;
  }

  /**
   * Format page context for chat message inclusion
   */
  formatContextForChat(context: PageContext): string {
    const contextParts: string[] = [];

    // Add page type and basic info
    switch (context.type) {
      case 'item-view':
        contextParts.push(`[PAGE: Viewing ethscription ${context.data.hashId}]`);
        break;
      case 'market':
        contextParts.push(`[PAGE: Browsing ${context.data.collection} ${context.data.marketType} market]`);
        break;
      case 'collection':
        contextParts.push(`[PAGE: On ${context.data.collection} collection page]`);
        break;
      case 'admin':
        contextParts.push(`[PAGE: Admin dashboard]`);
        break;
      default:
        contextParts.push(`[PAGE: ${context.route}]`);
    }

    // Add query parameters if relevant
    if (Object.keys(context.queryParams).length > 0) {
      const relevantParams = this.filterRelevantQueryParams(context.queryParams);
      if (Object.keys(relevantParams).length > 0) {
        contextParts.push(`[FILTERS: ${JSON.stringify(relevantParams)}]`);
      }
    }

    // Add user address
    if (context.data.userAddress) {
      contextParts.push(`[USER: ${context.data.userAddress}]`);
    }

    return contextParts.join(' ');
  }

  /**
   * Filter query parameters to only include relevant ones for context
   */
  private filterRelevantQueryParams(queryParams: Record<string, any>): Record<string, any> {
    const relevantKeys = [
      'sort', 'order', 'collection', 'listed', 'owner', 'creator',
      'minPrice', 'maxPrice', 'traits', 'rarity', 'search'
    ];

    const filtered: Record<string, any> = {};
    for (const key of relevantKeys) {
      if (queryParams[key] !== undefined) {
        filtered[key] = queryParams[key];
      }
    }

    return filtered;
  }

  /**
   * Get a simplified context string for quick reference
   */
  getSimpleContext(context: PageContext): string {
    switch (context.type) {
      case 'item-view':
        return `Looking at ethscription ${context.data.hashId}`;
      case 'market':
        return `Browsing ${context.data.collection} ${context.data.marketType} market`;
      case 'collection':
        return `On ${context.data.collection} collection page`;
      case 'admin':
        return `On admin dashboard`;
      default:
        return `On ${context.route}`;
    }
  }

  /**
   * Get network information from environment
   */
  private getNetworkInfo(): { chainId: number; name: 'mainnet' | 'sepolia'; env: string } {
    const chainId = environment.chainId;
    const name = chainId === 1 ? 'mainnet' : 'sepolia';
    const env = environment.env || 'unknown';

    return { chainId, name, env };
  }
}
