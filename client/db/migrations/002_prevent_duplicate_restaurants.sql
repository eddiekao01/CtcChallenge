-- Treat the same normalized restaurant name at the same normalized address as
-- one restaurant. An absent address is treated like an empty address, matching
-- the API's normalization of blank optional strings to NULL.
--
-- Keep this rule in PostgreSQL so concurrent POST requests cannot both pass an
-- application-level duplicate check and create the same restaurant.
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_unique_name_address
ON restaurants (LOWER(name), LOWER(COALESCE(address, '')));
