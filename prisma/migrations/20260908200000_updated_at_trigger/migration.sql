CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "shipments_set_updated_at"
    BEFORE UPDATE ON "shipments"
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
