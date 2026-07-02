ALTER TABLE "lead_activities" DROP CONSTRAINT IF EXISTS "lead_activities_type_check";
--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_type_check" CHECK ("type" in ('call', 'note', 'status_change', 'meeting', 'task', 'follow_up', 'assignment_change'));
