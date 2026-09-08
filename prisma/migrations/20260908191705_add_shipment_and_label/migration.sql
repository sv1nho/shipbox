-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "recipient_postal_code" TEXT NOT NULL,
    "recipient_country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "store" TEXT NOT NULL,
    "dropoff_date" DATE,
    "received_date" DATE,
    "decision_date" DATE,
    "order_number" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "shipment_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("shipment_id")
);

-- CreateIndex
CREATE INDEX "shipments_user_id_status_idx" ON "shipments"("user_id", "status");

-- CreateIndex
CREATE INDEX "shipments_user_id_deleted_at_idx" ON "shipments"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE UNIQUE INDEX "shipments_identity_key"
    ON "shipments" ("user_id", "carrier", "tracking_number")
    WHERE "deleted_at" IS NULL;

CREATE INDEX "shipments_store_trgm_idx"
    ON "shipments"
    USING gin (lower(immutable_unaccent("store")) gin_trgm_ops);

ALTER TABLE "shipments"
    ADD CONSTRAINT "shipments_carrier_check"
        CHECK ("carrier" IN ('bpost', 'postnl')),
    ADD CONSTRAINT "shipments_status_check"
        CHECK ("status" IN ('pending', 'dropped_off', 'received', 'refunded', 'rejected')),
    ADD CONSTRAINT "shipments_amount_cents_check"
        CHECK ("amount_cents" >= 0),
    ADD CONSTRAINT "shipments_dropoff_before_received_check"
        CHECK ("dropoff_date" IS NULL OR "received_date" IS NULL OR "dropoff_date" <= "received_date"),
    ADD CONSTRAINT "shipments_received_before_decision_check"
        CHECK ("received_date" IS NULL OR "decision_date" IS NULL OR "received_date" <= "decision_date"),
    ADD CONSTRAINT "shipments_dropoff_before_decision_check"
        CHECK ("dropoff_date" IS NULL OR "decision_date" IS NULL OR "dropoff_date" <= "decision_date"),
    ADD CONSTRAINT "shipments_status_requires_date_check"
        CHECK (
            ("status" <> 'dropped_off' OR "dropoff_date" IS NOT NULL)
            AND ("status" <> 'received' OR "received_date" IS NOT NULL)
            AND ("status" NOT IN ('refunded', 'rejected') OR "decision_date" IS NOT NULL)
        );
