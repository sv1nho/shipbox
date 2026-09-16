ALTER TABLE "shipments" ADD COLUMN "requested_date" DATE;

UPDATE "shipments"
SET "requested_date" = ("created_at" AT TIME ZONE 'Europe/Brussels')::date
WHERE "requested_date" IS NULL;

ALTER TABLE "shipments" ALTER COLUMN "requested_date" SET NOT NULL;

ALTER TABLE "shipments"
    ADD CONSTRAINT "shipments_requested_before_dropoff_check"
        CHECK ("dropoff_date" IS NULL OR "requested_date" <= "dropoff_date"),
    ADD CONSTRAINT "shipments_requested_before_received_check"
        CHECK ("received_date" IS NULL OR "requested_date" <= "received_date"),
    ADD CONSTRAINT "shipments_requested_before_decision_check"
        CHECK ("decision_date" IS NULL OR "requested_date" <= "decision_date");
