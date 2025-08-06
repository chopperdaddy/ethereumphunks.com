import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';
import { ignoredTraitFilters, ignoredTraitFiltersForCounts } from '@/constants/collections';

/**
 * Pipe that filters an array of Phunks based on their attributes
 *
 * Takes an array of Phunks and active trait filters and returns a filtered array
 * containing only Phunks that match all the specified trait criteria.
 *
 * @example
 * // Input phunks: Array of Phunk objects
 * // Input filters: { "Type": "Alien", "trait_count": "5" }
 * // Usage in template: *ngFor="let phunk of phunks | attributeFilter:activeFilters"
 */
@Pipe({
  standalone: true,
  name: 'attributeFilter'
})
export class AttributeFilterPipe implements PipeTransform {

  /**
   * Filters an array of Phunks based on trait filters
   * @param value - Array of Phunks to filter
   * @param activeTraitFilters - Object containing active trait filters
   * @returns Filtered array of Phunks that match all trait criteria
   */
  transform(value: Phunk[], activeTraitFilters: TraitFilter | null, slug: string): Phunk[] {
    if (!value) return [];
    if (!activeTraitFilters) return value;

    // Create copy of filters and remove address field since it's handled separately
    const traitFilters: TraitFilter = { ...activeTraitFilters };
    delete traitFilters['address'];

    let filtered = value;
    const filtersLength = Object.keys(traitFilters).length;
    const traitCountFilter = traitFilters['trait_count'];

    // Handle trait count filter if present
    if (traitCountFilter !== undefined) {
      const traitCount = Number(traitCountFilter);
      filtered = filtered.filter((res) => {
        if (!res.attributes) return false;
        // Count only traits (exclude Name, Description, and Sex)
        const actualTraitCount = res.attributes.filter(attr =>
          !ignoredTraitFiltersForCounts[slug]?.includes(attr.k)
        ).length;
        return actualTraitCount === traitCount;
      });
    }

    // Handle other trait filters
    if (filtersLength > 1 || (filtersLength === 1 && traitCountFilter === undefined)) {
      filtered = filtered.filter((res: Phunk) => {
        if (!res.attributes) return false;

        // Check each filter
        return Object.entries(traitFilters).every(([key, value]) => {
          // Skip trait_count as it's handled separately
          if (key === 'trait_count') return true;

          // Find the attribute with matching key
          const attribute = res.attributes?.find(attr => attr?.k === key);

          // Handle "none" case
          if (value === 'none') {
            return !attribute;
          }

          // Handle regular case
          return attribute?.v === value;
        });
      });
    }

    return filtered;
  }
}
