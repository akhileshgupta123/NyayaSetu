CREATE TABLE "answers" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"answer_text" text NOT NULL,
	"is_grounded" boolean DEFAULT false NOT NULL,
	"confidence_score" real,
	"prompt_version_id" text,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"is_redacted" boolean DEFAULT true NOT NULL,
	"related_conversation_id" text,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"source_title" text NOT NULL,
	"source_url" text,
	"excerpt" text,
	"rank" integer DEFAULT 0 NOT NULL,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'Untitled conversation' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reopened_at" timestamp with time zone,
	"exported_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"evaluation_run_id" text NOT NULL,
	"input_text" text NOT NULL,
	"expected_output" text,
	"actual_output" text,
	"passed" boolean,
	"evaluation_notes" text
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompt_version_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "jurisdiction_results" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" text,
	"state" text,
	"district" text,
	"forum_type" text,
	"determined_at" timestamp with time zone,
	"determination_basis" jsonb,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sequence_number" integer DEFAULT 0 NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"original_text" text NOT NULL,
	"redacted_text" text,
	"contains_pii" boolean DEFAULT false NOT NULL,
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_label" text NOT NULL,
	"prompt_text" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'consumer' NOT NULL,
	"display_name" text,
	"consent_given_at" timestamp with time zone,
	"consent_version" text,
	"preferred_language" text DEFAULT 'en',
	"owner_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_related_conversation_id_conversations_id_fk" FOREIGN KEY ("related_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_cases" ADD CONSTRAINT "evaluation_cases_evaluation_run_id_evaluation_runs_id_fk" FOREIGN KEY ("evaluation_run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdiction_results" ADD CONSTRAINT "jurisdiction_results_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jurisdiction_results" ADD CONSTRAINT "jurisdiction_results_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_owner_idx" ON "answers" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "answers_message_idx" ON "answers" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "audit_events_owner_idx" ON "audit_events" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "citations_owner_idx" ON "citations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "citations_answer_idx" ON "citations" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "conversations_owner_idx" ON "conversations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "jurisdiction_results_owner_idx" ON "jurisdiction_results" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "jurisdiction_results_conversation_idx" ON "jurisdiction_results" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_owner_idx" ON "messages" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "user_profiles_owner_idx" ON "user_profiles" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "_users_email_unique" ON "_users" USING btree ("email");