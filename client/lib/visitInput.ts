import { ApiError } from './errors';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MAX_AMOUNT_SPENT = 99_999_999.99;
const MAX_NOTES_LENGTH = 2_000;

interface VisitDetailsInput {
  date: string;
  amountSpent: number;
  rating: number;
  notes: string | null;
}

export type VisitRestaurantInput =
  | { type: 'existing'; id: number }
  | {
      type: 'new';
      name: string;
      cuisine: string | null;
      address: string | null;
    };

export interface VisitCreateInput extends VisitDetailsInput {
  restaurant: VisitRestaurantInput;
}

export type VisitUpdateInput = VisitDetailsInput;

async function readJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'Request body must contain valid JSON');
  }
}

function requireObject(
  value: unknown,
  message = 'Request body must be a JSON object'
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiError(400, message);
  }

  return value as Record<string, unknown>;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a string or null`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} must not exceed ${maxLength} characters`);
  }

  return trimmed === '' ? null : trimmed;
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `${field} is required and must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} must not exceed ${maxLength} characters`);
  }

  return trimmed;
}

function parseNumericId(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > POSTGRES_INTEGER_MAX
  ) {
    throw new ApiError(400, `${field} must be a positive integer`);
  }

  return value;
}

function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, 'date must use YYYY-MM-DD format');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ApiError(400, 'date must be a real calendar date');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (value > today) {
    throw new ApiError(400, 'date cannot be in the future');
  }

  return value;
}

function parseAmountSpent(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_AMOUNT_SPENT
  ) {
    throw new ApiError(
      400,
      `amountSpent must be a number between 0 and ${MAX_AMOUNT_SPENT}`
    );
  }

  const cents = Math.round(value * 100);
  if (Math.abs(value - cents / 100) > 1e-9) {
    throw new ApiError(400, 'amountSpent must not exceed two decimal places');
  }

  return value;
}

function parseRating(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 5
  ) {
    throw new ApiError(400, 'rating must be a number between 0 and 5');
  }

  const tenths = Math.round(value * 10);
  if (Math.abs(value - tenths / 10) > 1e-9) {
    throw new ApiError(400, 'rating must not exceed one decimal place');
  }

  return value;
}

function parseVisitDetails(body: Record<string, unknown>): VisitDetailsInput {
  return {
    date: parseDate(body.date),
    amountSpent: parseAmountSpent(body.amountSpent),
    rating: parseRating(body.rating),
    notes: optionalString(body.notes, 'notes', MAX_NOTES_LENGTH),
  };
}

function parseRestaurant(value: unknown): VisitRestaurantInput {
  const restaurant = requireObject(
    value,
    'restaurant is required and must be an object'
  );

  if (restaurant.type === 'existing') {
    return {
      type: 'existing',
      id: parseNumericId(restaurant.id, 'restaurant.id'),
    };
  }

  if (restaurant.type === 'new') {
    return {
      type: 'new',
      name: requiredString(restaurant.name, 'restaurant.name', 200),
      cuisine: optionalString(restaurant.cuisine, 'restaurant.cuisine', 100),
      address: optionalString(restaurant.address, 'restaurant.address', 500),
    };
  }

  throw new ApiError(
    400,
    'restaurant.type must be either existing or new'
  );
}

export async function parseVisitCreateInput(
  request: Request
): Promise<VisitCreateInput> {
  const body = requireObject(await readJsonRequest(request));
  return {
    restaurant: parseRestaurant(body.restaurant),
    ...parseVisitDetails(body),
  };
}

export async function parseVisitUpdateInput(
  request: Request
): Promise<VisitUpdateInput> {
  return parseVisitDetails(requireObject(await readJsonRequest(request)));
}

export function parseVisitId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ApiError(404, 'Visit not found');
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > POSTGRES_INTEGER_MAX) {
    throw new ApiError(404, 'Visit not found');
  }

  return id;
}

export function parseRestaurantFilter(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ApiError(400, 'restaurantId must be a positive integer');
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > POSTGRES_INTEGER_MAX) {
    throw new ApiError(400, 'restaurantId must be a positive integer');
  }

  return id;
}
