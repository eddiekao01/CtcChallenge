-- A visit doubles as one of Brennen's reviews. Existing visits inherit the
-- restaurant's seeded rating so old data renders as complete review entries.
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS rating NUMERIC(2, 1);

DO $$
BEGIN
  ALTER TABLE visits
  ADD CONSTRAINT visits_rating_range
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE visits AS visit
SET rating = restaurant.rating
FROM restaurants AS restaurant
WHERE visit."restaurantId" = restaurant.id
  AND visit.rating IS NULL;
