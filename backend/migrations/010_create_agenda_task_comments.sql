CREATE TABLE IF NOT EXISTS agenda_task_comments (
  id BIGSERIAL PRIMARY KEY,
  agenda_task_id BIGINT NOT NULL REFERENCES agenda_tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agenda_comments_task ON agenda_task_comments(agenda_task_id);
