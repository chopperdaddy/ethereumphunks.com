export const ignoredTraitFilters: { [key: string]: string[] } = {
  'ethereum-phunks': [],
  'missing-phunks': [],
  'misprint-mingos': [],
  'dysto-phunks': [],
  'call-data-comrades': ['Description', 'Name'],
};

export const ignoredTraitFiltersForCounts: { [key: string]: string[] } = {
  'ethereum-phunks': ['Sex'],
  'missing-phunks': ['Sex'],
  'misprint-mingos': [],
  'dysto-phunks': ['Sex'],
  'call-data-comrades': ['Description', 'Name'],
};
