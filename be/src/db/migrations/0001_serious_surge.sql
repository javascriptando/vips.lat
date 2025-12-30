CREATE TABLE "content_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"viewer_id" uuid,
	"fingerprint" varchar(64),
	"user_agent" text,
	"referer" text,
	"country" varchar(2),
	"duration" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"new_subscribers" integer DEFAULT 0 NOT NULL,
	"unsubscribes" integer DEFAULT 0 NOT NULL,
	"earnings" integer DEFAULT 0 NOT NULL,
	"profile_views" integer DEFAULT 0 NOT NULL,
	"total_subscribers" integer DEFAULT 0 NOT NULL,
	"total_posts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"viewer_id" uuid,
	"fingerprint" varchar(64),
	"user_agent" text,
	"referer" text,
	"country" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_views_content_id_idx" ON "content_views" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "content_views_creator_id_idx" ON "content_views" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "content_views_viewer_id_idx" ON "content_views" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX "content_views_created_at_idx" ON "content_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "content_views_fingerprint_idx" ON "content_views" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "daily_stats_creator_id_idx" ON "daily_stats" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "daily_stats_date_idx" ON "daily_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "daily_stats_creator_date_idx" ON "daily_stats" USING btree ("creator_id","date");--> statement-breakpoint
CREATE INDEX "profile_views_creator_id_idx" ON "profile_views" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "profile_views_viewer_id_idx" ON "profile_views" USING btree ("viewer_id");--> statement-breakpoint
CREATE INDEX "profile_views_created_at_idx" ON "profile_views" USING btree ("created_at");