ALTER TABLE "shipments"
    ADD COLUMN "last_chased_at" DATE,
    ADD CONSTRAINT "shipments_chased_after_dropoff_check"
        CHECK ("last_chased_at" IS NULL OR "dropoff_date" IS NULL OR "dropoff_date" <= "last_chased_at");
