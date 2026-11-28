ALTER TABLE "evaluation_cases" ADD COLUMN "owner_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD COLUMN "owner_user_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "evaluation_cases_owner_idx" ON "evaluation_cases" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "evaluation_runs_owner_idx" ON "evaluation_runs" USING btree ("owner_user_id");