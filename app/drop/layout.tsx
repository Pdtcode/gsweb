import type { Metadata } from "next";

import DropShell from "./drop-shell";

import { buildMetadata } from "@/lib/seo";

/**
 * The Drop section is shelved: unlinked from the navbar and removed from the
 * sitemap. Neither of those de-indexes it — a sitemap is a discovery hint, so
 * anything already in Google's index stays there as an orphan. `noindex` on the
 * page itself is what actually drops it out of search results.
 *
 * Note this is also why the route is NOT disallowed in robots.txt: blocking the
 * crawl would stop crawlers ever seeing this tag, leaving the stale entry in
 * place. Let them fetch the page and read the noindex.
 *
 * The route still builds and serves, so existing direct links keep working.
 *
 * This layout exists as a server component purely to carry that metadata — the
 * drop UI is a client component (video preloading, Sanity fetch, access state)
 * and client components cannot export `metadata`.
 */
export const metadata: Metadata = buildMetadata({
  title: "Drop",
  path: "/drop",
  noindex: true,
});

export default function DropLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DropShell>{children}</DropShell>;
}
