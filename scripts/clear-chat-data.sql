-- =====================================================
-- Clear Chat Data Script
-- =====================================================
-- ล้างข้อมูลแชททั้งหมด แต่เก็บ authentication ไว้
-- ใช้งาน: รันใน Supabase SQL Editor หรือ psql
-- =====================================================

-- เริ่มต้น transaction (ถ้าผิดพลาดจะ rollback ได้)
BEGIN;

-- ===== ลบข้อมูลตามลำดับ (เพื่อหลีกเลี่ยง foreign key constraints) =====

-- 1. ลบ checklist items ก่อน (ต้องลบก่อน events เพราะมี foreign key)
TRUNCATE TABLE event_checklist_items CASCADE;

-- 2. ลบ events
TRUNCATE TABLE events CASCADE;

-- 3. ลบ chat messages (ต้องลบก่อน conversations)
TRUNCATE TABLE chat_messages CASCADE;

-- 4. ลบ conversations
TRUNCATE TABLE chat_conversations CASCADE;

-- 5. ลบ user memories (ถ้ามี)
TRUNCATE TABLE user_memories CASCADE;

-- 6. ลบ ai scheduled actions (ถ้ามี)
TRUNCATE TABLE ai_scheduled_actions CASCADE;

-- 7. ลบ user profiles (ถ้ามี - แต่ table นี้ไม่ได้ใช้งานอยู่แล้ว)
TRUNCATE TABLE user_profiles CASCADE;

-- ===== แสดงผลลัพธ์ =====
DO $$
BEGIN
  RAISE NOTICE 'สำเร็จ! ล้างข้อมูลแชททั้งหมดแล้ว';
  RAISE NOTICE 'ข้อมูล auth.users ยังคงอยู่ - สามารถ login ได้เหมือนเดิม';
END $$;

-- Commit transaction
COMMIT;

-- ===== ตรวจสอบผลลัพธ์ (Optional) =====
-- รันคำสั่งเหล่านี้เพื่อยืนยันว่าข้อมูลถูกลบแล้ว

-- SELECT COUNT(*) as remaining_messages FROM chat_messages;
-- SELECT COUNT(*) as remaining_conversations FROM chat_conversations;
-- SELECT COUNT(*) as remaining_events FROM events;
-- SELECT COUNT(*) as remaining_checklist_items FROM event_checklist_items;
-- SELECT COUNT(*) as remaining_memories FROM user_memories;
-- SELECT COUNT(*) as remaining_actions FROM ai_scheduled_actions;
-- SELECT COUNT(*) as remaining_users FROM auth.users; -- ควรยังมีอยู่
