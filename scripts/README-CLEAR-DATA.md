# 🗑️ วิธีการล้างข้อมูลแชท

## ⚠️ คำเตือน
- การล้างข้อมูลจะไม่สามารถกู้คืนได้
- ข้อมูล login (auth.users) จะยังคงอยู่
- คุณจะยังเข้าสู่ระบบด้วย email/password เดิมได้

## 📋 ข้อมูลที่จะถูกลบ
- ✅ ข้อความแชททั้งหมด
- ✅ บทสนทนาทั้งหมด
- ✅ นัดหมายและ events ทั้งหมด
- ✅ Checklist items ทั้งหมด
- ✅ ความทรงจำที่ AI เก็บไว้
- ✅ Scheduled actions

## 🔒 ข้อมูลที่จะยังคงอยู่
- ✅ ข้อมูล login (email/password)
- ✅ Structure ของ database

---

## 🚀 วิธีการรัน

### วิธีที่ 1: ใช้ Supabase Dashboard (แนะนำ)

1. เปิด Supabase Dashboard: https://supabase.com/dashboard
2. เลือก Project ของคุณ
3. ไปที่ **SQL Editor** (เมนูด้านซ้าย)
4. คลิก **New Query**
5. Copy เนื้อหาจากไฟล์ `clear-chat-data.sql` วางลงไป
6. คลิก **Run** (หรือกด Cmd/Ctrl + Enter)
7. รอจนกว่าจะเสร็จ → จะแสดงข้อความ "สำเร็จ!"

### วิธีที่ 2: ใช้ Supabase CLI

```bash
# 1. เข้า directory ของโปรเจค
cd /Users/duke/Documents/abduloei

# 2. รัน SQL script
supabase db execute -f scripts/clear-chat-data.sql
```

### วิธีที่ 3: ใช้ psql (สำหรับผู้ที่ชำนาญ)

```bash
psql postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres \
  -f scripts/clear-chat-data.sql
```

---

## ✅ ตรวจสอบผลลัพธ์

หลังจากรันเสร็จ ให้รัน SQL นี้เพื่อยืนยัน:

```sql
-- ตรวจสอบว่าข้อมูลถูกลบหมดแล้ว
SELECT
  (SELECT COUNT(*) FROM chat_messages) as messages,
  (SELECT COUNT(*) FROM chat_conversations) as conversations,
  (SELECT COUNT(*) FROM events) as events,
  (SELECT COUNT(*) FROM event_checklist_items) as checklist_items,
  (SELECT COUNT(*) FROM user_memories) as memories,
  (SELECT COUNT(*) FROM ai_scheduled_actions) as scheduled_actions,
  (SELECT COUNT(*) FROM auth.users) as users; -- ควรยังมีอยู่ (ไม่เป็น 0)
```

**ผลลัพธ์ที่คาดหวัง:**
```
messages = 0
conversations = 0
events = 0
checklist_items = 0
memories = 0
scheduled_actions = 0
users = 1 (หรือมากกว่า - ขึ้นอยู่กับจำนวน users ที่ลงทะเบียน)
```

---

## 🔄 หลังจากล้างข้อมูลแล้ว

1. **Refresh หน้าเว็บ** (Cmd/Ctrl + R)
2. **Login ด้วย email/password เดิม**
3. **เริ่มแชทใหม่ได้ทันที** - ระบบจะสร้าง conversation ใหม่อัตโนมัติ

---

## 🆘 กรณีเกิดปัญหา

### ปัญหา: Error "relation does not exist"
**สาเหตุ:** บาง table อาจยังไม่ได้สร้าง (migration ยังไม่รัน)
**วิธีแก้:** รัน migration ก่อน
```bash
supabase db push
```

### ปัญหา: Error "permission denied"
**สาเหตุ:** ไม่มีสิทธิ์ลบข้อมูล
**วิธีแก้:** ใช้ Supabase Dashboard แทน หรือใช้ service_role key

### ปัญหา: หลังล้างแล้ว login ไม่ได้
**สาเหตุ:** ไม่น่าเกิดขึ้น (auth.users ไม่ได้ถูกลบ)
**วิธีแก้:** ตรวจสอบว่า auth.users ยังมีข้อมูลอยู่ไหม:
```sql
SELECT email FROM auth.users;
```

---

## 📝 หมายเหตุ

- Script นี้ใช้ `TRUNCATE TABLE` ซึ่งเร็วกว่า `DELETE FROM`
- `CASCADE` จะลบข้อมูล related tables ด้วยอัตโนมัติ
- Transaction (`BEGIN`/`COMMIT`) ทำให้ rollback ได้ถ้าเกิด error
