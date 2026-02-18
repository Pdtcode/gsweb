import { NextResponse } from "next/server";

import { client as sanityClient } from "@/sanity/lib/client";

// Module-level in-memory cache — avoids repeated Sanity fetches within TTL window
let cachedLocations: any[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const PICKUP_LOCATIONS_QUERY = `
  *[_type == "pickupLocation" && isActive == true] | order(lower(name) asc) {
    _id,
    name,
    "address": {
      "street": street,
      "city": city,
      "state": state,
      "zip": zip
    }
  }
`;

export async function GET() {
  try {
    // Return cached response if still within TTL
    if (cachedLocations !== null && Date.now() < cacheExpiresAt) {
      return NextResponse.json({ locations: cachedLocations });
    }

    // Fetch from Sanity (public CDN client — no token needed for public data)
    const locations = await sanityClient.fetch(PICKUP_LOCATIONS_QUERY);

    // Update cache
    cachedLocations = locations ?? [];
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return NextResponse.json({ locations: cachedLocations });
  } catch (error) {
    console.error("Failed to fetch pickup locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch pickup locations" },
      { status: 500 },
    );
  }
}
