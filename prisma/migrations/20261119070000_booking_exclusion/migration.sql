CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE "BookingSeat"
  ADD COLUMN "start" TIMESTAMP(3),
  ADD COLUMN "end" TIMESTAMP(3);

UPDATE "BookingSeat" AS bs
SET "start" = b."start", "end" = b."end"
FROM "Booking" AS b
WHERE b."id" = bs."bookingId";

ALTER TABLE "BookingSeat"
  ALTER COLUMN "start" SET NOT NULL,
  ALTER COLUMN "end" SET NOT NULL;

ALTER TABLE "BookingSeat"
  ADD CONSTRAINT "BookingSeat_seat_time_excl"
  EXCLUDE USING gist ("seatId" WITH =, tsrange("start", "end", '[)') WITH &&);
