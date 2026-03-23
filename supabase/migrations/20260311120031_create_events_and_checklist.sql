-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  home_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  event_time TIME,
  location TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event Checklist Items Table
CREATE TABLE IF NOT EXISTS event_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  assignee TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_event_id ON event_checklist_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_order_index ON event_checklist_items(order_index);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Users can view their own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for event_checklist_items
CREATE POLICY "Users can view checklist items of their events"
  ON event_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_checklist_items.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create checklist items for their events"
  ON event_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_checklist_items.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update checklist items of their events"
  ON event_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_checklist_items.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete checklist items of their events"
  ON event_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_checklist_items.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at on events
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on event_checklist_items
CREATE TRIGGER update_event_checklist_items_updated_at
  BEFORE UPDATE ON event_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update parent event's updated_at when checklist item changes
CREATE OR REPLACE FUNCTION update_event_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE events
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_on_checklist_change
  AFTER INSERT OR UPDATE OR DELETE ON event_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_event_timestamp();
