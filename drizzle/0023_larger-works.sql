ALTER TABLE works ADD COLUMN larger_work text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE works ADD COLUMN part_number integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE works ADD CONSTRAINT works_part_number_valid CHECK (part_number BETWEEN 1 AND 10000);
--> statement-breakpoint
CREATE INDEX idx_works_parts ON works(author_id,larger_work,part_number,id);
