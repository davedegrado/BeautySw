CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Garanzia a livello di database: nessun dipendente può avere due appuntamenti sovrapposti.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("employee_id" WITH =, tstzrange("start_at", "end_at") WITH &&)
  WHERE ("status" IN ('confirmed', 'completed'));
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_points_non_negative" CHECK ("points_balance" >= 0);
