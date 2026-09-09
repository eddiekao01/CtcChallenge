import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseError } from 'pg';
import { ApiError, handleError } from './errors';
import {
  parseRestaurantId,
  parseRestaurantInput,
} from './restaurantInput';

test('accepts positive PostgreSQL integer restaurant IDs', () => {
  assert.equal(parseRestaurantId('1'), 1);
  assert.equal(parseRestaurantId('2147483647'), 2_147_483_647);
});

const invalidIds = [
  'abc',
  '0',
  '-1',
  '1.5',
  '1e2',
  '0x10',
  ' 7 ',
  '+7',
  '2147483648',
];

for (const id of invalidIds) {
  test(`rejects invalid restaurant ID ${JSON.stringify(id)} with 404`, () => {
    assert.throws(
      () => parseRestaurantId(id),
      (err: unknown) => err instanceof ApiError && err.status === 404
    );
  });
}

test('normalizes a valid restaurant body', () => {
  assert.deepEqual(
    parseRestaurantInput({
      name: '  Valid Spot  ',
      cuisine: '  Japanese  ',
      address: '',
      rating: 4.5,
      id: 999,
      createdAt: 'not trusted',
    }),
    {
      name: 'Valid Spot',
      cuisine: 'Japanese',
      address: null,
      rating: 4.5,
    }
  );
});

test('defaults omitted optional fields to null', () => {
  assert.deepEqual(parseRestaurantInput({ name: 'Valid Spot' }), {
    name: 'Valid Spot',
    cuisine: null,
    address: null,
    rating: null,
  });
});

const invalidBodies: Array<[string, unknown]> = [
  ['a null body', null],
  ['an array body', []],
  ['a missing name', {}],
  ['an empty name', { name: '   ' }],
  ['a non-string name', { name: 42 }],
  ['a non-string cuisine', { name: 'Valid Spot', cuisine: {} }],
  ['a non-string address', { name: 'Valid Spot', address: 10 }],
  ['a numeric-string rating', { name: 'Valid Spot', rating: '4.5' }],
  ['a rating below zero', { name: 'Valid Spot', rating: -0.1 }],
  ['a rating above five', { name: 'Valid Spot', rating: 5.1 }],
  ['an infinite rating', { name: 'Valid Spot', rating: Infinity }],
];

for (const [description, body] of invalidBodies) {
  test(`rejects ${description} with a 400 API error`, () => {
    assert.throws(
      () => parseRestaurantInput(body),
      (err: unknown) => err instanceof ApiError && err.status === 400
    );
  });
}

test('maps malformed JSON syntax errors to a safe 400 response', async () => {
  const response = handleError(new SyntaxError('internal parser detail'));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Request body must contain valid JSON',
  });
});

for (const [code, message] of [
  ['23505', 'Resource conflicts with existing data'],
  ['23503', 'Operation conflicts with related data'],
] as const) {
  test(`maps PostgreSQL ${code} conflicts to a safe 409 response`, async () => {
    const err = new DatabaseError('sensitive database message', 0, 'error');
    err.code = code;
    err.detail = 'sensitive database detail';

    const response = handleError(err);

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: message });
  });
}

test('logs unexpected errors and returns a generic 500 response', async () => {
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);

  try {
    const response = handleError(new Error('sensitive internal failure'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'Internal Server Error',
    });
    assert.equal(logged.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});
