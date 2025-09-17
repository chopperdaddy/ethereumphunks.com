import { Pipe, PipeTransform } from '@angular/core';
import { Phunk } from '@/models/db';
import { TraitFilter } from '@/models/global-state';
import { Collection } from '@/models/data.state';

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
  transform(
    value: Phunk[] | null,
    activeTraitFilters: TraitFilter | null,
    slug: string,
    collections: Collection[] | null
  ): Phunk[] | null {

    if (!value) return null;
    if (!activeTraitFilters) return value;

    const collection = collections?.find(collection => collection.slug === slug);
    if (!collection) return value;

    // console.log({value, activeTraitFilters, slug, collections});
    // Create copy of filters and remove address field since it's handled separately
    const traitFilters: TraitFilter = { ...activeTraitFilters };
    delete traitFilters['address'];

    let filtered = value;
    const filtersLength = Object.keys(traitFilters).length;
    const traitCountFilter = traitFilters['trait_count'];

    // Handle trait count filter if present
    if (traitCountFilter !== undefined) {
      filtered = filtered.filter((res) => {
        if (!res.attributes) return false;
        // Count only traits (exclude Name, Description, and Sex)
        const actualTraitCount = res.attributes.filter(attr =>
          !collection.ignoredTraitFiltersForCounts?.includes(attr.k)
        ).length;

        // Check if it's a range filter (e.g., "3-7")
        if (typeof traitCountFilter === 'string' && traitCountFilter.includes('-')) {
          const [minStr, maxStr] = traitCountFilter.split('-');
          const min = parseInt(minStr, 10);
          const max = parseInt(maxStr, 10);

          if (!isNaN(min) && !isNaN(max)) {
            return actualTraitCount >= min && actualTraitCount <= max;
          }
        }

        // Handle exact match (backwards compatible)
        const traitCount = Number(traitCountFilter);
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

          // Handle range filters for numeric attributes (e.g., "1-10")
          if (typeof value === 'string' && value.includes('-') && value.match(/^\d+-\d+$/)) {
            const [minStr, maxStr] = value.split('-');
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);

            if (!isNaN(min) && !isNaN(max) && attribute?.v !== null && attribute?.v !== undefined) {
              const attributeValue = parseInt(attribute.v.toString(), 10);
              if (!isNaN(attributeValue)) {
                return attributeValue >= min && attributeValue <= max;
              }
            }
            // If parsing fails, fall back to exact string match
            return attribute?.v === value;
          }

          // Handle regular exact match case
          return attribute?.v === value;
        });
      });
    }

    return filtered;
  }
}
