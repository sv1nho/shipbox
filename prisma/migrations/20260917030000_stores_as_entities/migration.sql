CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "support_email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stores_user_id_name_key" ON "stores"("user_id", "name");

ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "stores_set_updated_at"
    BEFORE UPDATE ON "stores"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

INSERT INTO "stores" ("user_id", "name")
SELECT DISTINCT "user_id", "store" FROM "shipments";

ALTER TABLE "shipments" ADD COLUMN "store_id" UUID;

UPDATE "shipments" AS s
SET "store_id" = st."id"
FROM "stores" AS st
WHERE st."user_id" = s."user_id" AND st."name" = s."store";

ALTER TABLE "shipments" ALTER COLUMN "store_id" SET NOT NULL;

ALTER TABLE "shipments" DROP COLUMN "store";

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "shipments_store_id_idx" ON "shipments"("store_id");
