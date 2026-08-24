import { safeJsonLd, type StructuredDataNode } from "@/lib/structured-data";

export function StructuredData({ data }: { data: StructuredDataNode | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
