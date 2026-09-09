# Write-up

## 1. What did you build for Part B, and why that?

I turned the starter list into Brennen's restaurant journal: a small, original
Yelp-inspired interface where he can search restaurants, log meals, attach a
rating and review, and see spending totals and visit history. Reviews are not a
second, disconnected concept—a visit is the review and receipt record. That fit
the existing schema and the product's core question, “where did Brennen eat and
how much did he spend?”, while making the seeded data genuinely useful.

The most important flow is logging a first visit to a new restaurant. One API
request creates or reuses the restaurant and creates its visit in a database
transaction, so a failure cannot leave a restaurant with no corresponding
review. A normalized database uniqueness index and an atomic upsert also make
simultaneous submissions converge on one restaurant.

## 2. What did you decide, and what did you rule out?

I kept the fixed Part A restaurant API intact and added a focused `/api/visits`
resource. The UI talks only to route handlers; it never imports the database.
Each route validates unknown JSON before querying, uses parameterized SQL, maps
Postgres values into the documented JSON types, and sends unexpected failures
through the shared safe error handler.

I deliberately did not add authentication, images, social profiles, pagination,
or a separate reviews table. Those could be useful, but they would dilute a
finished single-user journal. I also chose full replacement semantics for visit
`PUT`, matching the restaurant API, rather than introducing PATCH semantics.

## 3. Where did you cut corners?

The interface uses browser confirmation dialogs for destructive actions and
simple modal behavior rather than a full accessible dialog/focus-trap library.
With another day I would add database-backed integration tests to CI and cursor
pagination for a much larger visit history. I would also decide whether a
restaurant's manually entered overall rating should coexist with or be fully
replaced by its average visit rating; the UI currently prefers the visit average
when reviews exist.

## 4. What should we look at first?

Start with **Write a review → New restaurant**. It demonstrates the full slice:
validated UI input, one transactional HTTP request, duplicate-safe restaurant
creation, a persisted review, and immediate updates to totals and the review
feed. Then edit that review and try malformed requests against the routes below.

---

## Part B: routes

| Method and path | What it does | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/visits` | Lists visits, newest first. Optional `?restaurantId=1`. | `200` + visit array | `400` for an invalid filter |
| `GET /api/visits/:id` | Reads one visit. | `200` + visit | `404` for a missing or invalid ID |
| `POST /api/visits` | Adds a visit to an existing restaurant, or atomically creates/reuses a restaurant and adds its first visit. | `201` + creation result | `400` invalid body; `404` missing restaurant; `409` conflict |
| `PUT /api/visits/:id` | Replaces a visit's date, amount, rating, and notes. | `200` + visit | `400` invalid body; `404` missing/invalid ID |
| `DELETE /api/visits/:id` | Deletes one visit. | `204`, no body | `404` missing/invalid ID |

A visit response has this shape:

```json
{
  "id": 4,
  "restaurantId": 1,
  "date": "2026-09-09",
  "amountSpent": 27.45,
  "rating": 4.5,
  "notes": "Would return.",
  "createdAt": "2026-09-09T19:30:00.000Z"
}
```

`POST /api/visits` accepts either an existing restaurant:

```json
{
  "restaurant": { "type": "existing", "id": 1 },
  "date": "2026-09-09",
  "amountSpent": 27.45,
  "rating": 4.5,
  "notes": "Would return."
}
```

or a new restaurant:

```json
{
  "restaurant": {
    "type": "new",
    "name": "Noodle Lab",
    "cuisine": "Taiwanese",
    "address": "9 Test Kitchen Way"
  },
  "date": "2026-09-09",
  "amountSpent": 27.45,
  "rating": 4.5,
  "notes": "Would return."
}
```

Its `201` response is:

```json
{
  "visit": { "id": 4, "restaurantId": 6, "date": "2026-09-09" },
  "restaurant": { "id": 6, "name": "Noodle Lab" },
  "restaurantCreated": true
}
```

The abbreviated objects above contain all fields from the visit and restaurant
shapes. `restaurantCreated` is `false` when normalized name/address matching
reuses an existing restaurant.

`PUT /api/visits/:id` accepts the visit fields without `restaurant`:

```json
{
  "date": "2026-09-09",
  "amountSpent": 29.95,
  "rating": 5,
  "notes": "Still would return."
}
```

## Schema changes

- `002_prevent_duplicate_restaurants.sql` adds a case-insensitive unique restaurant
  identity on name plus normalized address. Migration 002 checks for existing
  duplicates first and raises a clear error rather than silently discarding data.
- `003_add_visit_rating.sql` adds `visits.rating NUMERIC(2,1)`, constrains it to
  `0–5`, and backfills seeded visits from their restaurant rating. Both new
  migrations are re-runnable through `npm run migrate`.
- No extra setup is required beyond `./setup.sh`; its migration runner discovers
  the new files automatically.

## How I verified this

From `client/`:

```bash
npm run migrate
npm test
npm run lint
npm run build
```

The unit suite covers restaurant and visit parsing, normalization, malformed
JSON, ID boundaries (including leading zeros), real/future dates, numeric
precision and ranges, and nullable fields.

I also exercised every route against Docker PostgreSQL, including valid,
malformed, missing, and invalid inputs. Representative checks:

```bash
curl -i http://127.0.0.1:3000/api/restaurants
curl -i http://127.0.0.1:3000/api/restaurants/abc
curl -i -X POST http://127.0.0.1:3000/api/restaurants \
  -H 'Content-Type: application/json' \
  -d '{"name":"Out Of Range","rating":6}'

curl -i 'http://127.0.0.1:3000/api/visits?restaurantId=1'
curl -i -X POST http://127.0.0.1:3000/api/visits \
  -H 'Content-Type: application/json' \
  -d '{"restaurant":{"type":"existing","id":1},"date":"2026-09-09","amountSpent":27.45,"rating":4.5,"notes":"Would return."}'
curl -i -X PUT http://127.0.0.1:3000/api/visits/4 \
  -H 'Content-Type: application/json' \
  -d '{"date":"2026-09-09","amountSpent":29.95,"rating":5,"notes":"Still would return."}'
curl -i -X DELETE http://127.0.0.1:3000/api/visits/4
```

The live API pass included 30 assertions and restored the seed dataset
afterward. I separately verified in the browser that create/edit/search flows
persist, review cards render under the right restaurant, and summary totals
recalculate.

## Known issues / what I'd do next

There are no known broken challenge flows. This remains intentionally a
single-user journal with an in-memory client view after initial load; concurrent
changes made in another tab appear after refresh. At larger scale I would add
authentication, pagination, cache revalidation, accessible focus trapping, and
an automated database integration job.
