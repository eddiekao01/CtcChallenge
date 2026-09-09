import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { ApiError, handleError } from '@/lib/errors';
import {
  parseRestaurantId,
  parseRestaurantInput,
} from '@/lib/restaurantInput';
import { toRestaurant } from '@/lib/types';

type Params = { params: { id: string } };

/**
 * GET /api/restaurants/:id
 * Returns a single restaurant, or 404 if it doesn't exist.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      'SELECT * FROM restaurants WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PUT /api/restaurants/:id
 * Update an existing restaurant.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const input = await parseRestaurantInput(req);
    const { rows } = await pool.query(
      `UPDATE restaurants
       SET name = $2, cuisine = $3, address = $4, rating = $5
       WHERE id = $1
       RETURNING *`,
      [id, input.name, input.cuisine, input.address, input.rating]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/restaurants/:id
 * Delete a restaurant.
 *
 * Worth noticing: the migration already made a call about what happens to that
 * restaurant's visits. Go read it. If you disagree with it, say so in your
 * write-up.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      `DELETE FROM restaurants
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
