# Testing Guide: Nested Event Checklist Feature

## Prerequisites
1. ✅ Database migration completed (events & event_checklist_items tables created)
2. ✅ User logged in to the application
3. ✅ Chat interface is working

---

## Test 1: AI Parsing with Checklist Items

### Input
พิมพ์ในแชท:
```
วันศุกร์หน้าต้องไปต่างจังหวัด ต้องเอากุญแจใส่กระเป๋าใหญ่ และบอกตาว่าปิดประตูหลัง และอย่าลืมเอาของฝากไปไว้บนโต๊ะกินข้าว
```

### Expected Behavior
1. AI ตรวจจับว่าเป็นคำสั่ง `create_event`
2. แสดง CommandCard พร้อมข้อมูล:
   - Title: "ไปต่างจังหวัด"
   - Date: วันศุกร์หน้า (auto-calculated)
   - Checklist Preview:
     - ☐ เอากุญแจใส่กระเป๋าใหญ่
     - ☐ บอกตาว่าปิดประตูหลัง (assignee: ตา)
     - ☐ เอาของฝากไปไว้บนโต๊ะกินข้าว
3. AI ถาม: "ต้องการให้สร้างนัดหมาย 'ไปต่างจังหวัด' ใช่ไหมคะ?"

### Validation
- ✅ Parse ได้ 3 checklist items
- ✅ Assignee "ตา" ถูกแยกออกมาจาก "บอกตาว่า..."
- ✅ วันที่ถูก parse จาก "วันศุกร์หน้า"

---

## Test 2: Confirm & Create Event with Checklist

### Input
พิมพ์ตอบกลับ:
```
ใช่ค่ะ
```

### Expected Behavior
1. ระบบเรียก `createEventWithChecklist()` server action
2. สร้าง event ใน database
3. สร้าง checklist items 3 รายการ พร้อม assignee
4. AI ตอบกลับ: "สร้างนัดหมาย 'ไปต่างจังหวัด' พร้อม checklist 3 รายการเรียบร้อยแล้วค่ะ ✅"

### Database Validation
เปิด Supabase Dashboard → Table Editor → ตรวจสอบ:

**Table: events**
```sql
SELECT * FROM events WHERE title = 'ไปต่างจังหวัด' ORDER BY created_at DESC LIMIT 1;
```
Expected:
- ✅ มี record 1 รายการ
- ✅ user_id ตรงกับ logged-in user
- ✅ event_date เป็นวันศุกร์หน้า
- ✅ priority = 'medium'
- ✅ status = 'pending'

**Table: event_checklist_items**
```sql
SELECT * FROM event_checklist_items
WHERE event_id = (SELECT id FROM events WHERE title = 'ไปต่างจังหวัด' ORDER BY created_at DESC LIMIT 1)
ORDER BY order_index;
```
Expected:
- ✅ มี 3 records
- ✅ order_index: 0, 1, 2
- ✅ completed: false (ทั้งหมด)
- ✅ assignee:
  - Item 1: null
  - Item 2: "ตา"
  - Item 3: null

---

## Test 3: Simple Event without Checklist

### Input
```
พรุ่งนี้ 14:00 นัดหมอ
```

### Expected Behavior
1. Parse เป็น event โดยไม่มี checklist_items
2. CommandCard ไม่แสดงส่วน checklist
3. สร้างได้ปกติ

---

## Test 4: Event with Single Checklist Item

### Input
```
วันอาทิตย์ต้องไปตลาด ต้องซื้อไข่
```

### Expected Behavior
1. Parse ได้ checklist 1 item: "ซื้อไข่"
2. แสดง preview ใน CommandCard
3. สร้างได้สำเร็จ

---

## Test 5: Assignee Patterns

### Test 5.1: "บอก[ชื่อ]ว่า..."
```
พรุ่งนี้ออกจากบ้าน ต้องบอกแม่ว่าล็อกประตู
```
Expected assignee: "แม่"

### Test 5.2: "ให้[ชื่อ]..."
```
วันเสาร์ต้องไปงาน ให้พี่ชายช่วยจัดของ
```
Expected assignee: "พี่ชาย"

### Test 5.3: "[ชื่อ]ต้อง..."
```
พรุ่งนี้มีงาน น้องต้องทำการบ้าน
```
Expected assignee: "น้อง"

---

## Test 6: UI Interaction (Optional - if implementing event detail page)

### Prerequisites
- สร้าง event detail page ที่แสดง ChecklistManager component

### Test Steps
1. เปิด event detail page
2. Toggle checkbox → ตรวจสอบว่า completed status เปลี่ยน
3. เพิ่ม item ใหม่ → แสดงใน list
4. แก้ไข title → บันทึกได้
5. ลบ item → หายจาก list

### Expected Behavior
- ✅ Checkbox toggle อัพเดท database realtime
- ✅ Progress bar แสดง % ที่ถูกต้อง
- ✅ Add/Edit/Delete ทำงานได้ไม่ติดขัด
- ✅ Toast notifications แสดงผลถูกต้อง

---

## Test 7: Error Handling

### Test 7.1: Unauthorized Access
1. Logout
2. ลองเรียก `createEventWithChecklist()` direct
3. Expected: { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }

### Test 7.2: Invalid Event ID
```typescript
await updateChecklistItem('invalid-uuid', { completed: true })
```
Expected: { success: false, error: 'ไม่พบ checklist item นี้' }

### Test 7.3: Empty Title
```typescript
await addChecklistItem(eventId, '')
```
Expected: Error or validation failure

---

## Test 8: RLS Policies

### Setup
1. สร้าง user A และ user B
2. User A สร้าง event พร้อม checklist

### Test
1. Login เป็น user B
2. ลองดึง event ของ user A
3. Expected: ไม่เห็นข้อมูล (RLS blocked)

### SQL Test
```sql
-- Login as user B
-- Try to select user A's event
SELECT * FROM events WHERE user_id != auth.uid();
```
Expected: Empty result (0 rows)

---

## Performance Test

### Test Large Checklist
1. สร้าง event พร้อม checklist 20+ items
2. ตรวจสอบ:
   - ✅ Load time < 2 seconds
   - ✅ UI ไม่ lag
   - ✅ Database query ใช้ index (ตรวจสอบ EXPLAIN ANALYZE)

---

## Integration Test Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| AI Parsing with Checklist | ⏳ Pending | Test with real chat |
| Create Event + Checklist | ⏳ Pending | Verify database |
| Simple Event (no checklist) | ⏳ Pending | Backward compatible |
| Assignee Extraction | ⏳ Pending | Test all 3 patterns |
| UI Interactions | ⏳ Optional | Requires detail page |
| Error Handling | ⏳ Pending | Test edge cases |
| RLS Policies | ⏳ Pending | Security validation |
| Performance | ⏳ Pending | Large dataset test |

---

## Debug Tips

### Enable Debug Logs
1. เปิด browser console (F12)
2. ดู network requests ไป `/api/chat`
3. ตรวจสอบ payload และ response

### Check Database State
```sql
-- Count total events
SELECT COUNT(*) FROM events;

-- Count checklist items
SELECT
  e.title,
  COUNT(ci.id) as checklist_count
FROM events e
LEFT JOIN event_checklist_items ci ON e.id = ci.event_id
GROUP BY e.id, e.title;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('events', 'event_checklist_items');
```

### Common Issues

**Issue: Checklist items not parsing**
- Check keyword patterns in `extractChecklistItems()`
- Verify text normalization (lowercase)

**Issue: Database insert fails**
- Check RLS policies are enabled
- Verify auth.uid() is available
- Check foreign key constraints

**Issue: UI not updating**
- Verify server action returns updated data
- Check onUpdate/onDelete callbacks
- Clear React state if needed

---

## Success Criteria

Feature is considered complete when:
- ✅ All 8 test cases pass
- ✅ No console errors
- ✅ Database constraints enforced
- ✅ RLS policies working
- ✅ UI responsive and smooth
- ✅ Thai language support fully working
- ✅ Error messages user-friendly
