-- A queued work can receive all requested critiques before a reading-room slot opens.
CREATE FUNCTION notify_queued_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT COUNT(*) FROM reviews WHERE work_id=NEW.id AND version=NEW.version)>=COALESCE(NEW.target_reviews,2) THEN
  PERFORM notify_work_event(NEW.id,NEW.id,'completed','complete:'||NEW.id||':'||NEW.version,'');
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER queued_completion_updates AFTER UPDATE OF status ON works FOR EACH ROW WHEN(OLD.status='queued' AND NEW.status='open') EXECUTE FUNCTION notify_queued_completion();
