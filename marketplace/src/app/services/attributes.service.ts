import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, from, switchMap, filter, tap, shareReplay, of, map } from 'rxjs';

import { Attribute, AttributeItem } from '@/models/attributes';
import { Phunk } from '@/models/db';

import { ignoredTraitFilters, ignoredTraitFiltersForCounts, mainTrait } from '@/constants/collections';

import { StorageService } from '@/services/storage.service';

import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AttributesService {

  private attributeCache = new Map<string, Observable<AttributeItem | null>>();
  private rarityCache = new Map<string, { [key: string]: number }>();

  constructor(
    private http: HttpClient,
    private storageSvc: StorageService,
  ) {}

  /**
   * Fetches attributes for a collection
   * @param slug Collection slug
   */
  getAttributes(slug: string): Observable<AttributeItem | null> {
    if (!this.attributeCache.has(slug)) {
      const attributes$ = from(this.storageSvc.getItem<AttributeItem>(`${slug}__attributes`)).pipe(
        switchMap((res: AttributeItem | null) => {
          if (res) return of(res);
          return this.fetchAttributes(slug);
        }),
        filter((res: AttributeItem | null) => !!res),
        tap((res: AttributeItem) => this.createFilters(slug, res)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.attributeCache.set(slug, attributes$);
    }
    return this.attributeCache.get(slug)!;
  }

  /**
   * Gets rarity data for a collection
   * @param slug Collection slug
   */
  async getRarityData(slug: string): Promise<{ [key: string]: number } | null> {
    if (!this.rarityCache.has(slug)) {
      const rarity = await this.storageSvc.getItem<{ [key: string]: number }>(`${slug}__rarity`);
      if (rarity) {
        this.rarityCache.set(slug, rarity);
      }
    }
    return this.rarityCache.get(slug)!;
  }

  /**
   * Fetches attributes for a collection from the static URL
   * @param slug Collection slug
   */
  fetchAttributes(slug: string): Observable<AttributeItem> {
    return this.http.get<AttributeItem>(`${environment.staticUrl}/data/${slug}_attributes.json`).pipe(
      switchMap((res: AttributeItem) => from(this.cacheAttributes(slug, res))),
    );
  }

  /**
   * Caches attributes for a collection
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async cacheAttributes(slug: string, attributes: AttributeItem) {
    const stored = await this.storageSvc.setItem<AttributeItem>(`${slug}__attributes`, attributes);
    return stored;
  }

  /**
   * Creates filters for a collection and generates rarity data
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async createFilters(slug: string, attributes: AttributeItem) {
    // Create a map to store unique attribute keys and their possible values
    const attributeMap = new Map<string, Set<string>>();
    // Track which attributes are present in all items
    const totalAttributeCount = new Map<string, number>();
    // Track frequency of each value for each attribute
    const valueFrequency = new Map<string, Map<string, number>>();
    // Track trait counts for each item
    const traitCounts = new Set<number>();
    const totalItems = Object.keys(attributes).length;

    // Iterate through all attributes for each item
    Object.values(attributes).forEach((item: Attribute[]) => {
      // Track which attributes are present in this item
      const presentAttributes = new Set<string>();

      // Count traits for this item (excluding Description and Name)
      let traitCount = 0;

      item.forEach((attribute: Attribute) => {
        // Skip Description and Name attributes since they aren't used for filtering
        if (ignoredTraitFilters[slug]?.includes(attribute.k)) return;

        // Count traits (exclude mainTrait from trait counting, but still include it as a filter)
        if (!ignoredTraitFiltersForCounts[slug]?.includes(attribute.k)) {
          traitCount++;
        }

        // Initialize a new Set for this attribute key if it doesn't exist
        if (!attributeMap.has(attribute.k)) {
          attributeMap.set(attribute.k, new Set());
          valueFrequency.set(attribute.k, new Map<string, number>());
        }

        // Get the attribute values
        const value = attribute.v;
        // Handle both array and single string values
        if (Array.isArray(value)) {
          // Add each value from the array to the Set
          value.forEach(v => {
            attributeMap.get(attribute.k)?.add(v);
            const freqMap = valueFrequency.get(attribute.k)!;
            freqMap.set(v, (freqMap.get(v) || 0) + 1);
          });
        } else {
          // Add the single value to the Set
          attributeMap.get(attribute.k)?.add(value);
          const freqMap = valueFrequency.get(attribute.k)!;
          freqMap.set(value, (freqMap.get(value) || 0) + 1);
        }

        // Mark this attribute as present in this item
        presentAttributes.add(attribute.k);
      });

      // Add this item's trait count to the set
      traitCounts.add(traitCount);

      // Update count for each attribute present in this item
      presentAttributes.forEach(attr => {
        totalAttributeCount.set(attr, (totalAttributeCount.get(attr) || 0) + 1);
      });
    });

    // Convert the Map of Sets into a plain object with arrays
    const attributeObject: { [key: string]: string[] | number[] } = {};
    attributeMap.forEach((values, key) => {
      // Sort values by frequency (most common first)
      const sortedValues = Array.from(values).sort((a, b) => {
        const freqA = valueFrequency.get(key)!.get(a) || 0;
        const freqB = valueFrequency.get(key)!.get(b) || 0;
        return freqB - freqA; // Sort in descending order of frequency
      });

      // Check if all values in the set are numbers
      const allNumbers = Array.from(values).every(value => typeof value === 'number');

      // Add "none" option if the attribute isn't present in all items
      if (totalAttributeCount.get(key) !== totalItems && !allNumbers) {
        sortedValues.unshift('none');
      }

      attributeObject[key] = sortedValues;
    });

    // Add trait count filter options
    const sortedTraitCounts = Array.from(traitCounts).sort((a, b) => a - b);
    attributeObject['trait_count'] = sortedTraitCounts.map(count => count);

    // Generate rarity data from value frequencies
    const rarityData: { [key: string]: number } = {};
    valueFrequency.forEach((valueMap, attributeKey) => {
      valueMap.forEach((count, value) => {
        rarityData[value] = count;
      });
    });

    // Store both the filters object and rarity data in local storage
    const [storedFilters, storedRarity] = await Promise.all([
      this.storageSvc.setItem(`${slug}__filters`, attributeObject),
      this.storageSvc.setItem(`${slug}__rarity`, rarityData)
    ]);

    // Cache rarity data in memory for synchronous access
    this.rarityCache.set(slug, rarityData);

    return { storedFilters, storedRarity };
  }

  /**
   * Gets filters for a collection
   * @param slug Collection slug
   */
  async getFilters(slug: string): Promise<{ [key: string]: string[] } | null> {
    const stored = await this.storageSvc.getItem<{ [key: string]: string[] }>(`${slug}__filters`);
    return stored;
  }

  /**
   * Adds attributes to an array of Phunks
   * @param slug Collection slug
   * @param phunks Array of Phunks to add attributes to
   */
  addAttributes(slug: string | undefined, phunks: Phunk[]): Observable<Phunk[]> {
    if (!phunks.length) return of(phunks);
    if (!slug) return of(phunks);

    return this.getAttributes(slug).pipe(
      filter((res: AttributeItem | null) => !!res),
      map((res: AttributeItem | null) => {
        return phunks.map((item: Phunk) => {
          const originalAttributes = item.sha ? res![item.sha] : [];
          if (!originalAttributes) return item;

          const attributes = [...originalAttributes]?.sort((a: Attribute, b: Attribute) => {
            if (a.k === mainTrait[slug]) return -1;
            if (b.k === mainTrait[slug]) return 1;
            return 0;
          });

          return { ...item, attributes };
        });
      }),
    );
  }
}
