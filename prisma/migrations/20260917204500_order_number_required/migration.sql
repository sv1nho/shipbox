UPDATE "shipments"
SET "order_number" = "tracking_number"
WHERE "order_number" IS NULL OR btrim("order_number") = '';

ALTER TABLE "shipments"
    ALTER COLUMN "order_number" SET NOT NULL,
    ADD CONSTRAINT "shipments_order_number_check"
        CHECK (btrim("order_number") <> '');
