export type CatalogSearchKind = "product" | "category" | "task";

export type CatalogRequestItem = {
  id: string;
  title: string;
  article: string;
  price?: string;
  image?: string;
  href: string;
};

export type CatalogSearchHit = {
  id: string;
  kind: CatalogSearchKind;
  eyebrow: string;
  title: string;
  meta: string;
  href: string;
  image?: string;
  price?: string;
  availability?: string;
  specs?: string[];
  requestItem?: CatalogRequestItem;
};

export type CatalogSearchResponse = {
  query: string;
  interpretation: string;
  products: CatalogSearchHit[];
  categories: CatalogSearchHit[];
  tasks: CatalogSearchHit[];
};

