ALTER TABLE "shipments" RENAME COLUMN "deleted_at" TO "archived_at";

DROP INDEX "shipments_identity_key";

DROP INDEX "shipments_user_id_deleted_at_idx";

CREATE INDEX "shipments_user_id_archived_at_idx" ON "shipments" ("user_id", "archived_at");

CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments" ("tracking_number");
