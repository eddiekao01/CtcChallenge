import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { ApiError, handleError } from '@/lib/errors';
import { toRestaurant, toVisit } from '@/lib/types';
import {
  parseRestaurantFilter,
  parseVisitCreateInput,
} from '@/lib/visitInput';

/** GET /api/visits, optionally filtered by restaurantId. */
export async function GET(request: Request) {
  try {
    const restaurantIdValue = new URL(request.url).searchParams.get(
      'restaurantId'
    );
    const restaurantId =
      restaurantIdValue === null
        ? null
        : parseRestaurantFilter(restaurantIdValue);

    const { rows } = await pool.query(
      restaurantId === null
        ? `SELECT * FROM visits
           ORDER BY date DESC, created_at DESC`
        : `SELECT * FROM visits
           WHERE "restaurantId" = $1
           ORDER BY date DESC, created_at DESC`,
      restaurantId === null ? [] : [restaurantId]
    );

    return NextResponse.json(rows.map(toVisit));
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/visits
 * Creates a review/visit for an existing restaurant or atomically creates a
 * new restaurant and its first visit.
 */
export async function POST(request: Request) {
  try {
    const input = await parseVisitCreateInput(request);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let restaurantRow: Record<string, unknown>;
      let restaurantCreated = false;

      if (input.restaurant.type === 'existing') {
        const { rows } = await client.query(
          'SELECT * FROM restaurants WHERE id = $1',
          [input.restaurant.id]
        );
        if (rows.length === 0) {
          throw new ApiError(404, 'Restaurant not found');
        }
        restaurantRow = rows[0];
      } else {
        const { rows } = await client.query(
          `INSERT INTO restaurants (name, cuisine, address, rating)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (LOWER(name), LOWER(COALESCE(address, '')))
           DO UPDATE SET name = restaurants.name
           RETURNING *, (xmax = 0) AS "restaurantCreated"`,
          [
            input.restaurant.name,
            input.restaurant.cuisine,
            input.restaurant.address,
          ]
        );
        restaurantRow = rows[0];
        restaurantCreated = Boolean(rows[0].restaurantCreated);
      }

      const { rows: visitRows } = await client.query(
        `INSERT INTO visits
           ("restaurantId", date, "amountSpent", rating, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          restaurantRow.id,
          input.date,
          input.amountSpent,
          input.rating,
          input.notes,
        ]
      );

      await client.query('COMMIT');

      return NextResponse.json(
        {
          visit: toVisit(visitRows[0]),
          restaurant: toRestaurant(restaurantRow),
          restaurantCreated,
        },
        { status: 201 }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return handleError(error);
  }
}
