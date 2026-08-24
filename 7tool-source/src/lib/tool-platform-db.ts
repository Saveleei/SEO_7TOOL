import { db } from "./db";
import { getPublicInteractiveTool, listPublicInteractiveTools } from "./tool-platform.mjs";

export type PublicToolSummary = {
  id: string;
  key: string;
  version: number;
  type: "ANNULAR_CUTTER_RPM" | "MAGNETIC_DRILL_SELECTOR" | "BEVELER_SELECTOR" | "PIPE_CUTTER_SELECTOR" | "COMPATIBILITY_TABLE";
  slug: string;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  description: string;
  indexStatus: "INDEX" | "NOINDEX";
  reviewedBy: string;
  publishedAt: number;
};

export type RpmToolRule = {
  cutterType: string;
  material: string;
  cuttingSpeed: number;
  unit: "m/min";
  assertionId: string;
};

export type SelectorCriterion = {
  name: string;
  label: string;
  capability: string;
  operator: "NUMBER_GTE" | "NUMBER_LTE" | "INCLUDES" | "RANGE_CONTAINS";
  unit?: string;
};

export type SelectorFact = {
  value: number | string[];
  unit: string;
  label: string;
  display: string;
  assertionIds: string[];
};

export type SelectorProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  category: string;
  facts: Record<string, SelectorFact>;
};

export type CompatibilityRow = {
  id: string;
  product: { id: string; slug: string; title: string };
  accessory: { id: string; slug: string; title: string };
  compatibilityType: string;
  shank: string | null;
  maxDiameter: string | null;
  depth: string | null;
  application: string | null;
  assertionId: string;
  directionAssertionId: string;
};

export type PublicInteractiveTool = PublicToolSummary & (
  | { type: "ANNULAR_CUTTER_RPM"; rules: RpmToolRule[] }
  | { type: "MAGNETIC_DRILL_SELECTOR" | "BEVELER_SELECTOR" | "PIPE_CUTTER_SELECTOR"; criteria: SelectorCriterion[]; products: SelectorProduct[] }
  | { type: "COMPATIBILITY_TABLE"; rows: CompatibilityRow[] }
);

export function listPublishedTools(): PublicToolSummary[] {
  return listPublicInteractiveTools(db()) as PublicToolSummary[];
}

export function getPublishedTool(slug: string): PublicInteractiveTool | undefined {
  return (getPublicInteractiveTool(db(), slug) as PublicInteractiveTool | null) ?? undefined;
}
