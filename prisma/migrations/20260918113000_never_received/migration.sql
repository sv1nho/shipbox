ALTER TABLE "shipments"
    ADD COLUMN "never_received" BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT "shipments_never_received_check"
        CHECK (NOT "never_received" OR "received_date" IS NULL);
