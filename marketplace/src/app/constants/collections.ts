export const ignoredTraitFilters: { [key: string]: string[] } = {
  'ethereum-phunks': [],
  'missing-phunks': [],
  'misprint-mingos': [],
  'dysto-phunks': [],
  'call-data-comrades': ['Description', 'Name'],
};

export const ignoredTraitFiltersForCounts: { [key: string]: string[] } = {
  'ethereum-phunks': ['Sex', 'Rank'],
  'missing-phunks': ['Sex', 'Rank'],
  'misprint-mingos': ['Rank'],
  'dysto-phunks': ['Sex', 'Rank'],
  'call-data-comrades': ['Description', 'Name', 'Classification', 'Affiliation', 'Rank'],
};

export const mainTrait: { [key: string]: string } = {
  'ethereum-phunks': 'Sex',
  'missing-phunks': 'Sex',
  'misprint-mingos': 'Type',
  'dysto-phunks': 'Sex',
  'call-data-comrades': 'Type',
};
