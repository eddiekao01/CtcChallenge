import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, handleError } from './errors';
import { parseRestaurantInput } from './restaurantInput';

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
