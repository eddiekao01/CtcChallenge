import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './errors';
import {
  parseRestaurantFilter,
  parseVisitCreateInput,
  parseVisitId,
  parseVisitUpdateInput,
} from './visitInput';

function jsonRequest(value: unknown): Request {
  return rawRequest(JSON.stringify(value));
}

function rawRequest(body: string): Request {
  return new Request('http://localhost/api/visits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

const validDetails = {
  date: '2026-01-12',
  amountSpent: 42.5,
  rating: 4.5,
  notes: '  Burger night with the crew.  ',
};

test('normalizes a visit for an existing restaurant', async () => {
  assert.deepEqual(
    await parseVisitCreateInput(
      jsonRequest({
        restaurant: { type: 'existing', id: 3 },
        ...validDetails,
      })
    ),
    {
      restaurant: { type: 'existing', id: 3 },
      date: '2026-01-12',
      amountSpent: 42.5,
      rating: 4.5,
      notes: 'Burger night with the crew.',
    }
  );
});

test('normalizes a visit and its new restaurant', async () => {
  const input = await parseVisitCreateInput(
    jsonRequest({
      restaurant: {
        type: 'new',
        name: '  New Place  ',
        cuisine: '  Korean  ',
        address: '   ',
      },
      ...validDetails,
    })
  );

  assert.deepEqual(input.restaurant, {
    type: 'new',
    name: 'New Place',
    cuisine: 'Korean',
    address: null,
  });
});

test('normalizes blank visit notes to null', async () => {
  const input = await parseVisitUpdateInput(
    jsonRequest({ ...validDetails, notes: '   ' })
  );
  assert.equal(input.notes, null);
});

test('rejects malformed visit JSON', async () => {
  await assert.rejects(
    () => parseVisitCreateInput(rawRequest('{"restaurant":')),
    isBadRequest
  );
});

const invalidCreateBodies: Array<[string, unknown]> = [
  ['a null body', null],
  ['an array body', []],
  ['a missing restaurant', validDetails],
  [
    'an unknown restaurant type',
    { restaurant: { type: 'mystery' }, ...validDetails },
  ],
  [
    'a non-integer restaurant id',
    { restaurant: { type: 'existing', id: 1.5 }, ...validDetails },
  ],
  [
    'a string restaurant id',
    { restaurant: { type: 'existing', id: '1' }, ...validDetails },
  ],
  [
    'a blank new restaurant name',
    { restaurant: { type: 'new', name: '   ' }, ...validDetails },
  ],
  [
    'an invalid new restaurant cuisine',
    {
      restaurant: { type: 'new', name: 'Place', cuisine: 12 },
      ...validDetails,
    },
  ],
  [
    'a missing date',
    {
      restaurant: { type: 'existing', id: 1 },
      amountSpent: 10,
      rating: 4,
    },
  ],
  [
    'a malformed date',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      date: '01/12/2026',
    },
  ],
  [
    'an impossible date',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      date: '2026-02-30',
    },
  ],
  [
    'a future date',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      date: '9999-12-31',
    },
  ],
  [
    'a string amount',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      amountSpent: '10.00',
    },
  ],
  [
    'a negative amount',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      amountSpent: -0.01,
    },
  ],
  [
    'an amount with too many decimals',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      amountSpent: 10.001,
    },
  ],
  [
    'an amount too large for NUMERIC(10,2)',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      amountSpent: 100_000_000,
    },
  ],
  [
    'a string rating',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      rating: '4.5',
    },
  ],
  [
    'a rating below zero',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      rating: -0.1,
    },
  ],
  [
    'a rating above five',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      rating: 5.1,
    },
  ],
  [
    'a rating with excess precision',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      rating: 4.25,
    },
  ],
  [
    'non-string notes',
    {
      restaurant: { type: 'existing', id: 1 },
      ...validDetails,
      notes: 123,
    },
  ],
];

for (const [description, body] of invalidCreateBodies) {
  test(`rejects ${description}`, async () => {
    await assert.rejects(
      () => parseVisitCreateInput(jsonRequest(body)),
      isBadRequest
    );
  });
}

test('accepts canonical and leading-zero visit IDs', () => {
  assert.equal(parseVisitId('7'), 7);
  assert.equal(parseVisitId('0007'), 7);
});

for (const value of ['abc', '0', '0000', '-1', '1.5', '2147483648']) {
  test(`rejects invalid visit ID ${value} with 404`, () => {
    assert.throws(
      () => parseVisitId(value),
      (error: unknown) => error instanceof ApiError && error.status === 404
    );
  });
}

test('accepts a valid restaurant filter', () => {
  assert.equal(parseRestaurantFilter('0003'), 3);
});

for (const value of ['abc', '0', '-1', '1.5', '2147483648']) {
  test(`rejects invalid restaurant filter ${value} with 400`, () => {
    assert.throws(() => parseRestaurantFilter(value), isBadRequest);
  });
}

function isBadRequest(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400;
}
