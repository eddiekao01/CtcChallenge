/**
 * The client side of the API: helpers the frontend uses to call the endpoints.
 *
 * Don't confuse this with `app/api/`, which is the other side of the same
 * boundary - the route handlers that *implement* those endpoints. This file
 * only ever talks to them over HTTP.
 *
 * The shapes these helpers return live in `lib/types.ts`, shared with the
 * handlers that produce them.
 */
import type { Restaurant, Visit } from './types';

// We read a base URL from the environment because Server Components fetch on
// the server, where relative URLs don't resolve - so we need an absolute origin.
// It's the same app on the same port, so this is normally just localhost:3000.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Fetch every restaurant from the API. */
export async function getRestaurants(): Promise<Restaurant[]> {
  return getJson<Restaurant[]>('/api/restaurants');
}

/** Fetch a single restaurant by id. */
export async function getRestaurant(id: number | string): Promise<Restaurant> {
  return getJson<Restaurant>(`/api/restaurants/${id}`);
}

/** Fetch every visit/review, newest first. */
export async function getVisits(): Promise<Visit[]> {
  return getJson<Visit[]>('/api/visits');
}
