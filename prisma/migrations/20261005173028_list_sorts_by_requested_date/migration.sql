-- CreateIndex
CREATE INDEX "shipments_user_id_requested_date_idx" ON "shipments"("user_id", "requested_date" DESC);
