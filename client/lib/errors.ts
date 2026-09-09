import { NextResponse } from 'next/server';
import { DatabaseError } from 'pg';

type ApiErrorStatus = 400 | 404 | 409;

export class ApiError extends Error {
  constructor(
    public readonly status: ApiErrorStatus,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Central error -> HTTP response mapper for the API route handlers. Call it
 * from a route's `catch` block so error handling lives in one place:
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     return handleError(err);
 *   }
 *
 * Expected API errors keep their safe message and status. Malformed JSON is a
 * 400. Unexpected failures are logged on the server and return a generic 500
 * without exposing internal details.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  if (err instanceof SyntaxError) {
    return NextResponse.json(
      { error: 'Request body must contain valid JSON' },
      { status: 400 }
    );
  }

  if (err instanceof DatabaseError) {
    if (err.code === '23505') {
      return NextResponse.json(
        { error: 'Resource conflicts with existing data' },
        { status: 409 }
      );
    }

    if (err.code === '23503') {
      return NextResponse.json(
        { error: 'Operation conflicts with related data' },
        { status: 409 }
      );
    }
  }

  console.error('Unhandled API error:', err);

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
