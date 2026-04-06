import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { Observable, from, switchMap, filter, tap, shareReplay, of, map, take, first } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import { Attribute, AttributeItems } from '@/models/attributes';
import { Phunk } from '@/models/db';

import { StorageService } from '@/services/storage.service';

import { environment } from '@environments/environment';
import { selectCollections } from '@/state/data/data-state.selectors';
import { Collection } from '@/models/data.state';

@Injectable({
  providedIn: 'root'
})
export class AttributesService {

  private attributeCache = new Map<string, Observable<AttributeItems | null>>();
  private rarityCache = new Map<string, { [key: string]: number }>();

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    private storageSvc: StorageService,
  ) {}

  /**
   * Adds attributes to an array of Phunks
   * @param slug Collection slug
   * @param phunks Array of Phunks to add attributes to
   */
  addAttributes(slug: string | undefined, phunks: Phunk[]): Observable<Phunk[]> {
    if (!phunks.length) return of(phunks);
    if (!slug) return of(phunks);

    return this.getAttributes(slug).pipe(
      filter((res: AttributeItems | null) => !!res),
      switchMap((res: AttributeItems | null) => {
        return this.store.select(selectCollections).pipe(
          first((collections: Collection[]) => {
            // Wait until we have the collection we're looking for
            return collections.some(c => c.slug === slug);
          }),
          map((collections: Collection[]) => collections.find((c: Collection) => c.slug === slug)),
          map((collection: Collection | undefined) => {
            return phunks.map((item: Phunk) => {
              const originalAttributes = item.sha ? res![item.sha] : [];
              if (!originalAttributes) return item;
              const attributes = [...originalAttributes]?.sort((a: Attribute, b: Attribute) => {
                if (a.k === collection?.mainTrait) return -1;
                if (b.k === collection?.mainTrait) return 1;
                return 0;
              });
              return { ...item, attributes };
            });
          }),
        )
      })
    );
  }

  /**
   * Fetches attributes for a collection
   * @param slug Collection slug
   */
  getAttributes(slug: string): Observable<AttributeItems | null> {
    if (!this.attributeCache.has(slug)) {
      const attributes$ = from(this.storageSvc.getItem<AttributeItems>(`${slug}__attributes`)).pipe(
        switchMap((attributes: AttributeItems | null) => {
          if (attributes) return of(attributes);
          return this.fetchAttributes(slug);
        }),
        filter((attributes: AttributeItems | null) => !!attributes),
        switchMap((attributes: AttributeItems) => this.store.select(selectCollections).pipe(
          filter((collections: Collection[]) => collections.length > 0),
          take(1),
          map((collections: Collection[]) => collections.find((collection: Collection) => collection.slug === slug)),
          tap((collection: Collection | undefined) => this.createFilters(slug, attributes, collection)),
          map(() => attributes),
        )),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this.attributeCache.set(slug, attributes$);
    }
    return this.attributeCache.get(slug)!;
  }

  /**
   * Fetches attributes for a collection from the static URL
   * @param slug Collection slug
   */
  private fetchAttributes(slug: string): Observable<AttributeItems> {
    return this.http.get<AttributeItems>(`${environment.staticUrl}/data/${slug}_attributes.json`).pipe(
      switchMap((res: AttributeItems) => from(this.cacheAttributes(slug, res))),
    );
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
   * Caches attributes for a collection
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async cacheAttributes(slug: string, attributes: AttributeItems) {
    const stored = await this.storageSvc.setItem<AttributeItems>(`${slug}__attributes`, attributes);
    return stored;
  }

  /**
   * Creates filters for a collection and generates rarity data
   * @param slug Collection slug
   * @param attributes Attributes
   */
  private async createFilters(slug: string, attributes: AttributeItems, collection: Collection | undefined) {
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
        if (collection?.ignoredTraitFilters?.includes(attribute.k)) return;

        // Count traits (exclude mainTrait from trait counting, but still include it as a filter)
        if (!collection?.ignoredTraitFiltersForCounts?.includes(attribute.k)) {
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
}
