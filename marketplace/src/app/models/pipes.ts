
export type Calcs = 'lowestListingPrice' | 'highestListingPrice' | 'lowestBidPrice' | 'highestBidPrice' | 'averageBidPrice' | 'averageYearBidPrice' | 'totalBidsValue';

export interface Sort { label: string, value: Sorts };
export type Sorts = 'recent' | 'price-low' | 'price-high' | 'id';

export type Totals = 'sales';

