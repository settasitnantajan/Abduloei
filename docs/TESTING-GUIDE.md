# AI Upgrade Testing Guide

## Pre-Testing Setup

### 1. Run Database Migrations

```bash
# Make sure Supabase is running locally
supabase start

# Run migrations
supabase db push

# Or manually:
psql $DATABASE_URL < supabase/migrations/20260312130000_add_memory_system.sql
psql $DATABASE_URL < supabase/migrations/20260312140000_add_proactive_features.sql
```

### 2. Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'user_memories', 'ai_scheduled_actions');

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('user_profiles', 'user_memories', 'ai_scheduled_actions');
```

### 3. Set Environment Variables

```bash
# .env.local
GEMINI_API_KEY=your_key
CRON_SECRET=your_secret_string
NEXT_PUBLIC_URL=http://localhost:3000
```

---

## Phase 2: Long-term Memory System

### Test 1: Family Member Extraction

**Test Case:**
```
User Message: "ชื่อแม่ผมคือสมหญิง"
```

**Expected Behavior:**
1. Message saved to database
2. Memory extracted automatically
3. Memory visible in `/profile/memories`

**Verification:**
```sql
SELECT * FROM user_memories
WHERE category = 'family'
AND key LIKE '%แม่%';
```

**Expected Result:**
```json
{
  "category": "family",
  "key": "แม่_name",
  "value": "สมหญิง",
  "confidence": 0.9
}
```

---

### Test 2: Preferences Extraction

**Test Case:**
```
User Message: "ผมชอบกินข้าวผัด แต่ไม่ชอบถั่ว"
```

**Expected Behavior:**
1. Two memories created:
   - Like: ข้าวผัด
   - Dislike: ถั่ว

**Verification:**
```sql
SELECT * FROM user_memories
WHERE category = 'preferences';
```

---

### Test 3: Habits Extraction

**Test Case:**
```
User Message: "ผมวิ่งออกกำลังกายทุกเช้า"
```

**Expected Memory:**
```json
{
  "category": "habits",
  "key": "routine_วิ่งออกกำลังกาย",
  "value": "วิ่งออกกำลังกาย ทุกเช้า",
  "confidence": 0.8
}
```

---

### Test 4: Memory Recall in Conversation

**Test Case:**
```
Step 1: "ชื่อแม่ผมคือสมหญิง"
Step 2: "แม่ผมชื่ออะไร?"
```

**Expected AI Response:**
```
"แม่คุณชื่อสมหญิงค่ะ"
```

**Verification:**
- Check context builder includes memories
- Check AI response references memory

---

### Test 5: UI - View Memories

**Steps:**
1. Navigate to `/profile/memories`
2. Verify memories display
3. Check category grouping
4. Verify colors and icons

**Expected UI:**
```
👨‍👩‍👧‍👦 ครอบครัว
- แม่_name: สมหญิง
  ความมั่นใจ: 90%
  [ลบ]

❤️ ความชอบ
- likes_ข้าวผัด: ข้าวผัด
  ความมั่นใจ: 85%
  [ลบ]
```

---

### Test 6: UI - Delete Memory

**Steps:**
1. Go to `/profile/memories`
2. Click "ลบ" button
3. Confirm deletion
4. Verify memory removed

**Expected:**
- Toast notification: "ลบความทรงจำแล้ว"
- Memory disappears from list
- Database record deleted

---

## Phase 3: Web Search Integration

### Test 1: Price Query

**Test Case:**
```
User Message: "ราคา iPhone 15 เท่าไหร่"
```

**Expected Behavior:**
1. `detectSearchNeed()` returns `needsSearch: true`
2. `searchWeb()` called with query
3. Response includes price information
4. Sources cited

**Verification:**
```typescript
// Check console logs
Search detected: price_query
Search results: [content with prices]
```

---

### Test 2: News Query

**Test Case:**
```
User Message: "ข่าวล่าสุดวันนี้"
```

**Expected Response:**
```
[News summary in Thai]

📚 แหล่งอ้างอิง:
1. https://...
2. https://...
```

---

### Test 3: Weather Query

**Test Case:**
```
User Message: "อากาศวันนี้กรุงเทพเป็นยังไง"
```

**Expected:**
- Weather information
- Temperature
- Conditions

---

### Test 4: No Search Needed

**Test Case:**
```
User Message: "สวัสดีครับ"
```

**Expected Behavior:**
1. `detectSearchNeed()` returns `needsSearch: false`
2. Normal AI response (no search)

---

## Phase 4: Proactive AI Features

### Test 1: Daily Summary Generation

**Setup:**
```sql
-- Create test events for today
INSERT INTO events (user_id, title, event_date, event_time)
VALUES
  ('user-uuid', 'ประชุมทีม', CURRENT_DATE, '09:00'),
  ('user-uuid', 'พบหมอ', CURRENT_DATE, '14:00');
```

**Test:**
```typescript
const summary = await generateDailySummary('user-uuid');
console.log(summary);
```

**Expected Output:**
```
🌅 สรุปวันนี้

มีนัดหมาย 2 รายการ:
- ประชุมทีม (09:00)
- พบหมอ (14:00)

ขอให้เป็นวันที่ดีนะคะ! 😊
```

---

### Test 2: Reminder Generation

**Setup:**
```sql
-- Create event for tomorrow
INSERT INTO events (user_id, title, event_date, event_time)
VALUES
  ('user-uuid', 'นัดหมอฟัน', CURRENT_DATE + INTERVAL '1 day', '10:00');
```

**Test:**
```typescript
const reminders = await generateReminders('user-uuid');
console.log(reminders);
```

**Expected Output:**
```javascript
[
  "⏰ เตือน: นัดหมอฟัน (พรุ่งนี้ 10:00)"
]
```

---

### Test 3: Smart Suggestions

**Test Cases:**

Morning (6 AM - 12 PM):
```typescript
// Set system time to 8 AM
const suggestion = await generateSuggestions('user-uuid');
// Expected: "สวัสดีตอนเช้าค่ะ อย่าลืมดื่มน้ำนะคะ 💧"
```

Evening (6 PM - 10 PM):
```typescript
// Set system time to 8 PM
const suggestion = await generateSuggestions('user-uuid');
// Expected: "ถึงเวลาพักผ่อนแล้ว อยากจัดการงานพรุ่งนี้ไหมคะ? 📝"
```

---

### Test 4: Proactive API Endpoint

**Test:**
```bash
# Set CRON_SECRET in .env.local
export CRON_SECRET="test-secret-123"

# Test endpoint
curl -X POST http://localhost:3000/api/proactive \
  -H "Authorization: Bearer test-secret-123" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 2,
  "total": 5
}
```

---

### Test 5: Unauthorized Access

**Test:**
```bash
curl -X POST http://localhost:3000/api/proactive \
  -H "Authorization: Bearer wrong-secret"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

---

## Phase 5: UI Improvements

### Test 1: Memory Page Rendering

**Steps:**
1. Login to app
2. Navigate to `/profile/memories`
3. Verify page loads without errors

**Checks:**
- [ ] Header displays correctly
- [ ] Memory count shown
- [ ] Categories grouped
- [ ] Colors applied
- [ ] Icons visible

---

### Test 2: Empty State

**Setup:**
```sql
-- Delete all memories for user
DELETE FROM user_memories WHERE user_id = 'user-uuid';
```

**Steps:**
1. Go to `/profile/memories`
2. Verify empty state displays

**Expected:**
```
🧠
ยังไม่มีความทรงจำ
เริ่มคุยกับ AI เพื่อสร้างความทรงจำครั้งแรก
```

---

### Test 3: Delete Functionality

**Steps:**
1. Create memory via chat
2. Go to `/profile/memories`
3. Click "ลบ" button
4. Confirm in dialog
5. Verify memory removed

**Checks:**
- [ ] Confirmation dialog appears
- [ ] Loading state shows
- [ ] Success toast displays
- [ ] Memory removed from UI
- [ ] Memory deleted from DB

---

### Test 4: Responsive Design

**Test on different screen sizes:**
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1920px)

**Verify:**
- Layout adapts correctly
- Text readable
- Buttons accessible
- No horizontal scroll

---

## Integration Tests

### Test 1: End-to-End Memory Flow

**Scenario:**
```
1. User sends: "ชื่อพ่อผมคือสมชาย"
2. Memory extracted and saved
3. User sends: "พ่อผมชื่ออะไร"
4. AI responds with: "พ่อคุณชื่อสมชายค่ะ"
5. User goes to /profile/memories
6. User sees memory and deletes it
7. User sends: "พ่อผมชื่ออะไร"
8. AI responds: "ไม่ทราบข้อมูลนี้ค่ะ"
```

---

### Test 2: Search + Memory Integration

**Scenario:**
```
1. User sends: "ชอบกินพิซซ่า"
2. Memory saved
3. User sends: "ราคาพิซซ่าเท่าไหร่"
4. AI searches web AND knows user likes pizza
5. Response personalized
```

---

### Test 3: Proactive + Events Integration

**Scenario:**
```
1. User creates event via chat
2. Cron job runs at 7 AM
3. Daily summary includes the event
4. User receives reminder 1 hour before
5. Event time arrives, suggestion sent
```

---

## Performance Tests

### Test 1: Memory Retrieval Speed

**Test:**
```typescript
console.time('memory-retrieval');
const { memories } = await retrieveMemories(userId);
console.timeEnd('memory-retrieval');
```

**Expected:** < 100ms

---

### Test 2: Context Building Time

**Test:**
```typescript
console.time('context-building');
const context = await buildAIContext(conversationId, message);
console.timeEnd('context-building');
```

**Expected:** < 500ms

---

### Test 3: Search Response Time

**Test:**
```typescript
console.time('web-search');
const result = await searchWeb("test query");
console.timeEnd('web-search');
```

**Expected:** < 3000ms (depends on Gemini API)

---

## Error Handling Tests

### Test 1: Database Connection Error

**Simulate:**
```typescript
// Stop Supabase
supabase stop

// Try to save memory
const result = await storeMemory(...);
```

**Expected:**
- Error caught gracefully
- User-friendly message
- No app crash

---

### Test 2: API Key Missing

**Test:**
```bash
# Remove GEMINI_API_KEY
unset GEMINI_API_KEY

# Try web search
curl ... (trigger search query)
```

**Expected:**
```
"ขอโทษค่ะ ไม่สามารถค้นหาข้อมูลได้ในขณะนี้"
```

---

### Test 3: Invalid Memory Category

**Test:**
```typescript
await storeMemory(userId, 'invalid_category', 'key', 'value');
```

**Expected:**
- Database constraint violation caught
- Error message: "เกิดข้อผิดพลาด"

---

## Rollback Plan

If issues found during testing:

### Rollback Migrations:
```bash
# Revert migrations
supabase db reset

# Or manually:
DROP TABLE ai_scheduled_actions;
DROP TABLE user_memories;
DROP TABLE user_profiles;
ALTER TABLE chat_messages DROP COLUMN embedding;
```

### Rollback Code:
```bash
# Git reset to before changes
git reset --hard <previous-commit-hash>

# Or remove specific files
rm -rf lib/ai/memory-manager.ts
rm -rf lib/ai/search-detector.ts
rm -rf lib/ai/web-searcher.ts
rm -rf lib/ai/proactive-engine.ts
# ... etc
```

---

## Success Criteria

All tests must pass before production deployment:

- [ ] All Phase 2 tests passing (6/6)
- [ ] All Phase 3 tests passing (4/4)
- [ ] All Phase 4 tests passing (5/5)
- [ ] All Phase 5 tests passing (4/4)
- [ ] Integration tests passing (3/3)
- [ ] Performance benchmarks met (3/3)
- [ ] Error handling verified (3/3)
- [ ] UI responsive on all devices
- [ ] No console errors
- [ ] No memory leaks

---

## Testing Checklist

### Before Testing:
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] App running locally
- [ ] Test user account created

### During Testing:
- [ ] Document all bugs found
- [ ] Screenshot UI issues
- [ ] Log performance metrics
- [ ] Note edge cases

### After Testing:
- [ ] Update bug tracker
- [ ] Create fix tickets
- [ ] Document workarounds
- [ ] Update user guide

---

**Last Updated:** 2026-03-12
**Status:** Ready for Testing
