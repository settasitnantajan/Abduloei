ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_1d_sent boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_1h_sent boolean DEFAULT false;
