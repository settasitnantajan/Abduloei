# Phase 1: Quick Start Testing Guide

## What Was Implemented

Phase 1 adds **empathetic AI with enhanced context awareness** to Abduloei:

1. **Enhanced AI Personality** - More caring, remembers 50 messages, shows empathy
2. **Context Builder** - AI knows about upcoming events, pending tasks, conversation history
3. **Emotion Detection** - Detects stressed, happy, confused, seeking_advice emotions
4. **Proactive Awareness** - AI mentions upcoming events when relevant

## Files Changed

### New Files
- `/lib/ai/context-builder.ts` - Main context gathering logic (async server-side)
- `/lib/ai/context-utils.ts` - Utility functions (emotion detection, prompt building)
- `/docs/PHASE-1-IMPLEMENTATION.md` - Full technical documentation

### Modified Files
- `/lib/ai/gemini.ts` - Enhanced SYSTEM_PROMPT, added context parameters
- `/app/api/chat/route.ts` - Integrated context builder and emotion detection

## Quick Test Scenarios

### Test 1: Emotion Detection - Stressed
```
You: วันนี้เครียดมากเลย งานเยอะแย่
Expected: AI responds with understanding and encouragement
Example: "เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด มีอะไรให้ช่วยไหมคะ?"
```

### Test 2: Emotion Detection - Happy
```
You: ดีใจมากๆ วันนี้ได้โปรโมชั่น 555
Expected: AI responds with congratulations
Example: "ดีใจด้วยนะคะ! ยินดีกับโปรโมชั่นนะคะ 🎉"
```

### Test 3: Context Awareness - Upcoming Events
```
Step 1: Create an event for tomorrow
You: สร้างนัดหมายประชุมทีม พรุ่งนี้ 10:00
AI: ยืนยันไหมคะ?
You: ใช่

Step 2: Chat normally
You: วันนี้มีอะไรให้ทำบ้าง
Expected: AI should mention "พรุ่งนี้มีประชุมทีมนะคะ"
```

### Test 4: Long Conversation Memory
```
Step 1: Have a 20+ message conversation about planning a party
You: วางแผนจัดงานเลี้ยงหน่อย
AI: (discusses party planning)
... (continue chatting)

Step 2: After 30 messages, ask:
You: เรื่องงานเลี้ยงที่คุยกันเมื่อกี้เป็นยังไง
Expected: AI remembers and references earlier messages
```

### Test 5: Pending Tasks Awareness
```
Step 1: Create event with checklist
You: สร้างนัดหมาย "งานเลี้ยงครอบครัว" วันเสาร์หน้า
AI: ยืนยันไหมคะ?
You: ใช่

Step 2: (Manually add checklist items via UI if possible)

Step 3: Ask about tasks
You: มีงานอะไรค้างอยู่บ้าง
Expected: AI is aware of pending checklist items
```

### Test 6: Confused User
```
You: งงจัง ไม่เข้าใจว่าจะใช้ระบบนี้ยังไง
Expected: AI detects confusion and explains clearly
Example: "ให้ช่วยอธิบายให้เข้าใจง่ายๆ นะคะ ระบบนี้..."
```

### Test 7: Seeking Advice
```
You: แนะนำหน่อยว่าจะวางแผนงานเลี้ยงครอบครัวดีไหม
Expected: AI gives thoughtful advice
Example: "เข้าใจค่ะ งานเลี้ยงครอบครัวเนี่ยควร..."
```

## How to Run

### Development Mode
```bash
npm run dev
```

Then visit: `http://localhost:3000/chat`

### Production Build (Optional)
```bash
npm run build
npm start
```

## Debugging Tips

### Check if Context is Being Passed
Add console.log in `/app/api/chat/route.ts`:
```typescript
console.log('AI Context:', contextPrompt);
console.log('Detected emotion:', emotion);
```

### Check Event Data
Add console.log in `/lib/ai/context-builder.ts`:
```typescript
console.log('Upcoming events:', upcomingEvents);
console.log('Pending tasks:', pendingTasks);
```

### Check Gemini Prompt
Add console.log in `/lib/ai/gemini.ts`:
```typescript
console.log('Full prompt:', fullPrompt);
```

## Success Criteria

Phase 1 is working if:
- ✅ AI detects emotions (test with "เครียด", "ดีใจ", "งง")
- ✅ AI remembers 50 messages (test long conversations)
- ✅ AI mentions upcoming events when relevant
- ✅ AI is aware of pending tasks
- ✅ Responses feel more empathetic and caring

## Common Issues

### Issue: AI doesn't mention events
**Cause:** Events may not have proper `event_date` in database
**Fix:** Check event creation, ensure date is set

### Issue: Emotion not detected
**Cause:** Thai keywords might not match
**Fix:** Add more keywords in `/lib/ai/context-utils.ts`

### Issue: Context seems empty
**Cause:** User might not have any events/tasks yet
**Fix:** Create some test data first

### Issue: Build fails
**Cause:** Pre-existing errors in notes/tasks pages (unrelated to Phase 1)
**Fix:** These are known issues, Phase 1 code compiles successfully

## Next Steps

After testing Phase 1 thoroughly:
1. Report any bugs or unexpected behavior
2. Suggest additional emotion keywords
3. Request Phase 2 implementation (Long-term Memory System)

## Architecture Overview

```
User Message
    ↓
API Route (/app/api/chat/route.ts)
    ↓
Build Context (context-builder.ts)
    ├─ Get 50 recent messages
    ├─ Get upcoming events (7 days)
    ├─ Get pending tasks
    └─ Generate conversation summary
    ↓
Detect Emotion (context-utils.ts)
    ↓
Generate AI Response (gemini.ts)
    ├─ SYSTEM_PROMPT (enhanced with empathy)
    ├─ Conversation history (50 messages)
    ├─ Additional context (events, tasks)
    └─ Emotion hint
    ↓
Add Empathetic Prefix (if needed)
    ↓
Return Response to User
```

## Environment Variables Required

Make sure `.env.local` has:
```
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Questions?

Refer to `/docs/PHASE-1-IMPLEMENTATION.md` for detailed technical documentation.

---

**Happy Testing!** 🎉
