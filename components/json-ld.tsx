import { jsonLd } from "@/lib/seo";

/**
 * Renders a JSON-LD structured-data <script>. Safe to use in Server
 * Components; the payload is escaped to prevent breaking out of the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
      type="application/ld+json"
    />
  );
}
