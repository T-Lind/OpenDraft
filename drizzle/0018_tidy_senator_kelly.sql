CREATE TABLE "work_flow_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"work_id" text NOT NULL,
	"kind" text NOT NULL,
	"genre" text NOT NULL,
	"target_reviews" integer NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_flow_events" ADD CONSTRAINT "work_flow_events_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_flow_once" ON "work_flow_events" USING btree ("work_id","kind");--> statement-breakpoint
CREATE INDEX "idx_work_flow_genre_time" ON "work_flow_events" USING btree ("genre","created_at");
--> statement-breakpoint
INSERT INTO settings(id,value) VALUES('queue-observation-start',(floor(extract(epoch FROM clock_timestamp())*1000)::bigint)::text) ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION record_work_flow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.author_id='' OR NEW.author_id LIKE 'sample-%' THEN RETURN NEW; END IF;
 IF OLD.status='queued' AND NEW.status='spotlight' THEN
  INSERT INTO work_flow_events(work_id,kind,genre,target_reviews,created_at) VALUES(NEW.id,'promoted',NEW.genre,COALESCE(NEW.target_reviews,2),floor(extract(epoch FROM clock_timestamp())*1000)::bigint) ON CONFLICT(work_id,kind) DO NOTHING;
 ELSIF OLD.status='spotlight' AND NEW.status='open'
  AND (SELECT COUNT(*) FROM reviews WHERE work_id=NEW.id AND version=NEW.version)>=COALESCE(NEW.target_reviews,2)
  AND EXISTS(SELECT 1 FROM work_flow_events WHERE work_id=NEW.id AND kind='promoted') THEN
  INSERT INTO work_flow_events(work_id,kind,genre,target_reviews,created_at) VALUES(NEW.id,'completed',NEW.genre,COALESCE(NEW.target_reviews,2),floor(extract(epoch FROM clock_timestamp())*1000)::bigint) ON CONFLICT(work_id,kind) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER track_work_flow AFTER UPDATE OF status ON works FOR EACH ROW WHEN(OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION record_work_flow();
