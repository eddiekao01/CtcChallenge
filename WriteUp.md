# Write-up

> This is the skeleton - replace everything in blockquotes with your own words
> and delete the prompts as you go. Aim for **~300 words** across the four
> questions; the route reference below can be as long as it needs to be.
>
> Write it like you're handing the work to a teammate. We'd rather read an
> honest "I ran out of time on X and here's what I'd do" than a polished list of
> accomplishments. **Submit this even if you didn't finish** - see CHALLENGE.md.

## 1. What did you build for Part B, and why that?

> What made you pick it over everything else you could have built? This is the
> question we care most about - the _why_ matters more than the _what_.

So when I was coding the challenge, the thing that keep sticking out into my eye is the fact that there aren't any buttons in the UI. I mean we can't assume every user will open the terminal and start hitting curl for the HTTP requests, a successful product doesn't do that. For other programmers, the code has to be readable; similarly, for users, the interface has to be usable, every function, every API call that is not in the interface would eventually go to waste.

Thus, I decided to make everything in the codebase useful, while making the experience of the app intuitive. I didn't grew up here, but I imagine the most intuitive food rating app would be something like yelp, which is review-based (you don't add the restaurant, you add reviews). And it really isn't that difficult, since the original type already have an interface of visit, by adding a note (review) field too it and recalling some of the functions, we can basically make the app review-based.

## 2. What did you decide, and what did you rule out?

> Route shapes, data model, where the logic lives, what you deliberately didn't do. Name a tradeoff you're not sure you got right.

I defined the case insensitive combination of the name and address of the restaurant as unique identifiers, because it is an nearly impossible scenario to have two restaurants of nearly the same name and address. It couldn't be two branches nor can it be a legacy store and the current store. This avoids the scenarios of for example Sakura House and sakura house being two different entries in the app, not counting for the same rating and reviews. I applied a migration so the db enforces these rules, so concurrent requests are considered for too. However, there is an imperfection related with address. Since address can be written and formatted in many different ways, 12 Main St and 12 Main Street would give different locations. If I had more time I would implement a more complete address matching.

## 3. Where did you cut corners?

> What would you fix first with another day?

Currently, data is fetched from the db when the page loads. At runtime, successful changes are saved to the database, but only the current browser’s in-memory state is re-rendered. Other open browsers do not fetch and render those changes until they refresh. Thus, if Brennen wants to see a change he made from another device or one made by his girlfriend, he would have to refresh. If I could change anything, the one I would change first is to add cache revalidation or a client-side data-fetching layer that automatically fetches every few seconds, so that the page remains synchronized with the SQL database even when Brennen edits on his phone and his laptop across different visits.

---

## Part B: routes

| Method and path          | What it does                                                                                  | Success                 |
| ------------------------ | --------------------------------------------------------------------------------------------- | ----------------------- |
| `GET /api/visits`        | Lists visits newest first.<br>Optionally filters by `?restaurantId=1`.                        | `200` + visit array     |
| `GET /api/visits/:id`    | Returns one visit.                                                                            | `200` + visit           |
| `POST /api/visits`       | Adds a visit to an existing restaurant.<br>It can atomically create/reuse a restaurant first. | `201` + creation result |
| `PUT /api/visits/:id`    | Replaces the visit's date, amount,<br>rating, and notes.                                      | `200` + updated visit   |
| `DELETE /api/visits/:id` | Deletes one visit/review.                                                                     | `204`, no response body |

### Error behavior

| Method and path          | Errors                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `GET /api/visits`        | `400` — invalid `restaurantId`                                                          |
| `GET /api/visits/:id`    | `404` — missing or invalid ID                                                           |
| `POST /api/visits`       | `400` — invalid body<br><br>`404` — missing restaurant<br><br>`409` — database conflict |
| `PUT /api/visits/:id`    | `400` — invalid body<br><br>`404` — missing or invalid ID                               |
| `DELETE /api/visits/:id` | `404` — missing or invalid ID                                                           |

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

| Migration                               | Schema change                                                                             | Reason                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `002_prevent_duplicate_restaurants.sql` | Adds a case-insensitive unique index on<br>`LOWER(name)` and normalized `LOWER(address)`. | Prevents duplicate restaurants at the same address,<br>including during concurrent requests.    |
| `003_add_visit_rating.sql`              | Adds `visits.rating NUMERIC(2,1)` with a<br>`0–5` check and backfills existing visits.    | Lets each visit act as a review with its own rating<br>while preserving the seeded review data. |

No extra setup is required. `./setup.sh` runs the migration runner, which
discovers and applies both files automatically.

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

> Anything broken, unfinished, or that you know is wrong. Being upfront here
> costs you nothing and tells us a lot.

Free-form address formatting can still create duplicate restaurants, and changes made on another device are not immediately visible. I would also test accessibility and empty, loading, and error states more systematically before considering the UI production-ready. I did not encounter any outstanding migration or API-route failures during the testing described below.
