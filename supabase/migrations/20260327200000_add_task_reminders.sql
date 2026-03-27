-- เพิ่ม reminder flags สำหรับ tasks เหมือน events
ALTER TABLE tasks ADD COLUMN reminder_1d_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN reminder_1h_sent BOOLEAN DEFAULT FALSE;
