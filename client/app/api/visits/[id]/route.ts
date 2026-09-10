import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { ApiError, handleError } from '@/lib/errors';
import { toVisit } from '@/lib/types';
import {
  parseVisitId,
  parseVisitUpdateInput,
} from '@/lib/visitInput';

type Params = { params: { id: string } };

/** GET /api/visits/:id */
export async function GET(_request: Request, { params }: Params) {
  try {
    const id = parseVisitId(params.id);
    const { rows } = await pool.query('SELECT * FROM visits WHERE id = $1', [
      id,
    ]);

    if (rows.length === 0) {
      throw new ApiError(404, 'Visit not found');
    }

    return NextResponse.json(toVisit(rows[0]));
  } catch (error) {
    return handleError(error);
  }
}

/** PUT /api/visits/:id */
export async function PUT(request: Request, { params }: Params) {
  try {
    const id = parseVisitId(params.id);
    const input = await parseVisitUpdateInput(request);
    const { rows } = await pool.query(
      `UPDATE visits
       SET date = $2, "amountSpent" = $3, rating = $4, notes = $5
       WHERE id = $1
       RETURNING *`,
      [id, input.date, input.amountSpent, input.rating, input.notes]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Visit not found');
    }

    return NextResponse.json(toVisit(rows[0]));
  } catch (error) {
    return handleError(error);
  }
}

/** DELETE /api/visits/:id */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const id = parseVisitId(params.id);
    const { rows } = await pool.query(
      'DELETE FROM visits WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Visit not found');
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}
