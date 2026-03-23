-- Proactive AI Features Migration
-- Enables scheduled actions, reminders, and daily summaries

CREATE TABLE ai_scheduled_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('reminder', 'daily_summary', 'suggestion')),
  schedule_time TIMESTAMPTZ NOT NULL,
  recurrence TEXT, -- 'daily', 'weekly', 'hourly', or cron expression
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions"
  ON ai_scheduled_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own actions"
  ON ai_scheduled_actions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_scheduled_actions_user ON ai_scheduled_actions(user_id);
CREATE INDEX idx_scheduled_actions_schedule ON ai_scheduled_actions(schedule_time) WHERE NOT executed;
CREATE INDEX idx_scheduled_actions_type ON ai_scheduled_actions(action_type);

COMMENT ON TABLE ai_scheduled_actions IS 'AI-scheduled proactive actions like reminders and summaries';
COMMENT ON COLUMN ai_scheduled_actions.recurrence IS 'Recurrence pattern: daily, weekly, hourly, or cron expression';
