import { ApiError } from './errors';

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export interface RestaurantInput {
  name: string;
  cuisine: string | null;
  address: string | null;
  rating: number | null;
}

export function parseRestaurantId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ApiError(404, 'Restaurant not found');
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > POSTGRES_INTEGER_MAX) {
    throw new ApiError(404, 'Restaurant not found');
  }

  return id;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a string or null`);
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseRestaurantInput(value: unknown): RestaurantInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const body = value as Record<string, unknown>;

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    throw new ApiError(400, 'name is required and must be a non-empty string');
  }

  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null) {
    if (
      typeof body.rating !== 'number' ||
      !Number.isFinite(body.rating) ||
      body.rating < 0 ||
      body.rating > 5
    ) {
      throw new ApiError(
        400,
        'rating must be a finite number between 0 and 5 or null'
      );
    }

    rating = body.rating;
  }

  return {
    name: body.name.trim(),
    cuisine: optionalString(body.cuisine, 'cuisine'),
    address: optionalString(body.address, 'address'),
    rating,
  };
}
