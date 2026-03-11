-- Make feedback_text nullable since some Google Forms responses don't have qualitative feedback
ALTER TABLE nps_responses ALTER COLUMN feedback_text DROP NOT NULL;
