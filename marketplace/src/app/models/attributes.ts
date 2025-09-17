export interface Attribute {
  k: string;
  v: string;
}

export interface AttributeItems {
  [sha: string]: Attribute[];
}
