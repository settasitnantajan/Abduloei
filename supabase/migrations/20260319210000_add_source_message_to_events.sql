-- เพิ่ม column source_message สำหรับเก็บข้อความแชทที่สร้าง event
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_message TEXT;
