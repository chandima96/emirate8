import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_properties_status" AS ENUM('draft', 'pending', 'published', 'unpublished', 'sold', 'rented', 'archived');
  CREATE TYPE "public"."enum_properties_purpose" AS ENUM('sale', 'rent');
  CREATE TYPE "public"."enum_properties_category" AS ENUM('residential', 'commercial');
  CREATE TYPE "public"."enum_properties_type" AS ENUM('Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Office', 'Retail', 'Warehouse', 'Plot');
  CREATE TYPE "public"."enum_properties_completion" AS ENUM('ready', 'offplan');
  CREATE TYPE "public"."enum_properties_emirate" AS ENUM('Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Umm Al Quwain', 'Fujairah');
  CREATE TYPE "public"."enum_properties_display_contact" AS ENUM('any', 'phone', 'whatsapp', 'email');
  CREATE TYPE "public"."enum_properties_rent_frequency" AS ENUM('yearly', 'monthly');
  CREATE TYPE "public"."enum_brokers_type" AS ENUM('broker', 'buyer');
  CREATE TYPE "public"."enum_enquiries_type" AS ENUM('property', 'broker', 'general');
  CREATE TYPE "public"."enum_enquiries_preferred_contact" AS ENUM('email', 'phone', 'whatsapp', 'any');
  CREATE TYPE "public"."enum_enquiries_status" AS ENUM('new', 'in_progress', 'closed');
  CREATE TYPE "public"."enum_waitlist_signups_role" AS ENUM('owner', 'broker', 'buyer', 'investor', 'other');
  CREATE TYPE "public"."enum_waitlist_signups_source" AS ENUM('homepage', 'sell', 'register', 'other');
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "properties_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"highlight" varchar
  );
  
  CREATE TABLE "properties_amenities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amenity" varchar
  );
  
  CREATE TABLE "properties_photos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "properties_floorplans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "properties_offplan_payment_plan" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"percent" numeric
  );
  
  CREATE TABLE "properties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"ref" varchar,
  	"status" "enum_properties_status" DEFAULT 'draft' NOT NULL,
  	"purpose" "enum_properties_purpose" NOT NULL,
  	"category" "enum_properties_category" DEFAULT 'residential',
  	"type" "enum_properties_type" NOT NULL,
  	"completion" "enum_properties_completion" DEFAULT 'ready',
  	"emirate" "enum_properties_emirate" DEFAULT 'Dubai',
  	"area" varchar NOT NULL,
  	"community" varchar,
  	"address" varchar,
  	"coordinates_lat" numeric,
  	"coordinates_lng" numeric,
  	"price" numeric NOT NULL,
  	"price_on_request" boolean DEFAULT false,
  	"size" numeric,
  	"beds" numeric,
  	"baths" numeric,
  	"parking" numeric,
  	"floor" numeric,
  	"total_floors" numeric,
  	"description" varchar,
  	"featured_image_id" integer,
  	"permit_number" varchar,
  	"permit_expiry" timestamp(3) with time zone,
  	"broker_id" integer,
  	"offplan_developer" varchar,
  	"offplan_handover" varchar,
  	"display_visible" boolean DEFAULT true,
  	"display_portfolio_featured" boolean DEFAULT false,
  	"display_contact" "enum_properties_display_contact" DEFAULT 'any',
  	"rent_frequency" "enum_properties_rent_frequency" DEFAULT 'yearly',
  	"rent_cheques" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brokers_specialties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"specialty" varchar
  );
  
  CREATE TABLE "brokers_languages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"language" varchar
  );
  
  CREATE TABLE "brokers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"photo_id" integer,
  	"rera_number" varchar,
  	"agency_id" integer,
  	"agency_label" varchar,
  	"title" varchar DEFAULT 'Real Estate Broker',
  	"bio" varchar,
  	"location" varchar,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"email" varchar,
  	"social_instagram" varchar,
  	"social_linkedin" varchar,
  	"stats_listing_count" numeric DEFAULT 0,
  	"stats_sold_count" numeric DEFAULT 0,
  	"stats_years_experience" numeric DEFAULT 0,
  	"stats_rating" numeric DEFAULT 0,
  	"stats_review_count" numeric DEFAULT 0,
  	"verified" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"type" "enum_brokers_type" DEFAULT 'broker',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agencies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"license_number" varchar,
  	"logo_id" integer,
  	"cover_image_id" integer,
  	"description" varchar,
  	"location" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"website" varchar,
  	"social_instagram" varchar,
  	"social_linkedin" varchar,
  	"social_facebook" varchar,
  	"featured" boolean DEFAULT false,
  	"verified" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"audience" varchar,
  	"price" numeric,
  	"seats" numeric,
  	"listings" numeric,
  	"selections" numeric,
  	"highlighted" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"message" varchar NOT NULL,
  	"type" "enum_enquiries_type" DEFAULT 'general',
  	"property_id" integer,
  	"broker_id" integer,
  	"preferred_contact" "enum_enquiries_preferred_contact" DEFAULT 'any',
  	"budget" numeric,
  	"status" "enum_enquiries_status" DEFAULT 'new',
  	"notes" varchar,
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "waitlist_signups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"role" "enum_waitlist_signups_role",
  	"source" "enum_waitlist_signups_source" DEFAULT 'homepage',
  	"message" varchar,
  	"contacted" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"properties_id" integer,
  	"brokers_id" integer,
  	"agencies_id" integer,
  	"plans_id" integer,
  	"enquiries_id" integer,
  	"waitlist_signups_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "properties_highlights" ADD CONSTRAINT "properties_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_amenities" ADD CONSTRAINT "properties_amenities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_photos" ADD CONSTRAINT "properties_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_photos" ADD CONSTRAINT "properties_photos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_floorplans" ADD CONSTRAINT "properties_floorplans_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties_floorplans" ADD CONSTRAINT "properties_floorplans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_offplan_payment_plan" ADD CONSTRAINT "properties_offplan_payment_plan_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties" ADD CONSTRAINT "properties_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "properties" ADD CONSTRAINT "properties_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brokers_specialties" ADD CONSTRAINT "brokers_specialties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brokers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brokers_languages" ADD CONSTRAINT "brokers_languages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brokers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brokers" ADD CONSTRAINT "brokers_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brokers" ADD CONSTRAINT "brokers_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agencies" ADD CONSTRAINT "agencies_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agencies" ADD CONSTRAINT "agencies_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brokers_fk" FOREIGN KEY ("brokers_id") REFERENCES "public"."brokers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agencies_fk" FOREIGN KEY ("agencies_id") REFERENCES "public"."agencies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enquiries_fk" FOREIGN KEY ("enquiries_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_waitlist_signups_fk" FOREIGN KEY ("waitlist_signups_id") REFERENCES "public"."waitlist_signups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "properties_highlights_order_idx" ON "properties_highlights" USING btree ("_order");
  CREATE INDEX "properties_highlights_parent_id_idx" ON "properties_highlights" USING btree ("_parent_id");
  CREATE INDEX "properties_amenities_order_idx" ON "properties_amenities" USING btree ("_order");
  CREATE INDEX "properties_amenities_parent_id_idx" ON "properties_amenities" USING btree ("_parent_id");
  CREATE INDEX "properties_photos_order_idx" ON "properties_photos" USING btree ("_order");
  CREATE INDEX "properties_photos_parent_id_idx" ON "properties_photos" USING btree ("_parent_id");
  CREATE INDEX "properties_photos_image_idx" ON "properties_photos" USING btree ("image_id");
  CREATE INDEX "properties_floorplans_order_idx" ON "properties_floorplans" USING btree ("_order");
  CREATE INDEX "properties_floorplans_parent_id_idx" ON "properties_floorplans" USING btree ("_parent_id");
  CREATE INDEX "properties_floorplans_image_idx" ON "properties_floorplans" USING btree ("image_id");
  CREATE INDEX "properties_offplan_payment_plan_order_idx" ON "properties_offplan_payment_plan" USING btree ("_order");
  CREATE INDEX "properties_offplan_payment_plan_parent_id_idx" ON "properties_offplan_payment_plan" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "properties_slug_idx" ON "properties" USING btree ("slug");
  CREATE INDEX "properties_featured_image_idx" ON "properties" USING btree ("featured_image_id");
  CREATE INDEX "properties_broker_idx" ON "properties" USING btree ("broker_id");
  CREATE INDEX "properties_updated_at_idx" ON "properties" USING btree ("updated_at");
  CREATE INDEX "properties_created_at_idx" ON "properties" USING btree ("created_at");
  CREATE INDEX "brokers_specialties_order_idx" ON "brokers_specialties" USING btree ("_order");
  CREATE INDEX "brokers_specialties_parent_id_idx" ON "brokers_specialties" USING btree ("_parent_id");
  CREATE INDEX "brokers_languages_order_idx" ON "brokers_languages" USING btree ("_order");
  CREATE INDEX "brokers_languages_parent_id_idx" ON "brokers_languages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "brokers_slug_idx" ON "brokers" USING btree ("slug");
  CREATE INDEX "brokers_photo_idx" ON "brokers" USING btree ("photo_id");
  CREATE INDEX "brokers_agency_idx" ON "brokers" USING btree ("agency_id");
  CREATE INDEX "brokers_updated_at_idx" ON "brokers" USING btree ("updated_at");
  CREATE INDEX "brokers_created_at_idx" ON "brokers" USING btree ("created_at");
  CREATE UNIQUE INDEX "agencies_slug_idx" ON "agencies" USING btree ("slug");
  CREATE INDEX "agencies_logo_idx" ON "agencies" USING btree ("logo_id");
  CREATE INDEX "agencies_cover_image_idx" ON "agencies" USING btree ("cover_image_id");
  CREATE INDEX "agencies_updated_at_idx" ON "agencies" USING btree ("updated_at");
  CREATE INDEX "agencies_created_at_idx" ON "agencies" USING btree ("created_at");
  CREATE INDEX "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "plans_slug_idx" ON "plans" USING btree ("slug");
  CREATE INDEX "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE INDEX "enquiries_property_idx" ON "enquiries" USING btree ("property_id");
  CREATE INDEX "enquiries_broker_idx" ON "enquiries" USING btree ("broker_id");
  CREATE INDEX "enquiries_updated_at_idx" ON "enquiries" USING btree ("updated_at");
  CREATE INDEX "enquiries_created_at_idx" ON "enquiries" USING btree ("created_at");
  CREATE UNIQUE INDEX "waitlist_signups_email_idx" ON "waitlist_signups" USING btree ("email");
  CREATE INDEX "waitlist_signups_updated_at_idx" ON "waitlist_signups" USING btree ("updated_at");
  CREATE INDEX "waitlist_signups_created_at_idx" ON "waitlist_signups" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_properties_id_idx" ON "payload_locked_documents_rels" USING btree ("properties_id");
  CREATE INDEX "payload_locked_documents_rels_brokers_id_idx" ON "payload_locked_documents_rels" USING btree ("brokers_id");
  CREATE INDEX "payload_locked_documents_rels_agencies_id_idx" ON "payload_locked_documents_rels" USING btree ("agencies_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("enquiries_id");
  CREATE INDEX "payload_locked_documents_rels_waitlist_signups_id_idx" ON "payload_locked_documents_rels" USING btree ("waitlist_signups_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "properties_highlights" CASCADE;
  DROP TABLE "properties_amenities" CASCADE;
  DROP TABLE "properties_photos" CASCADE;
  DROP TABLE "properties_floorplans" CASCADE;
  DROP TABLE "properties_offplan_payment_plan" CASCADE;
  DROP TABLE "properties" CASCADE;
  DROP TABLE "brokers_specialties" CASCADE;
  DROP TABLE "brokers_languages" CASCADE;
  DROP TABLE "brokers" CASCADE;
  DROP TABLE "agencies" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "enquiries" CASCADE;
  DROP TABLE "waitlist_signups" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_properties_status";
  DROP TYPE "public"."enum_properties_purpose";
  DROP TYPE "public"."enum_properties_category";
  DROP TYPE "public"."enum_properties_type";
  DROP TYPE "public"."enum_properties_completion";
  DROP TYPE "public"."enum_properties_emirate";
  DROP TYPE "public"."enum_properties_display_contact";
  DROP TYPE "public"."enum_properties_rent_frequency";
  DROP TYPE "public"."enum_brokers_type";
  DROP TYPE "public"."enum_enquiries_type";
  DROP TYPE "public"."enum_enquiries_preferred_contact";
  DROP TYPE "public"."enum_enquiries_status";
  DROP TYPE "public"."enum_waitlist_signups_role";
  DROP TYPE "public"."enum_waitlist_signups_source";`)
}
