# Phase 1: AI Context & Empathy Flow Diagram

## Complete Request-Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SENDS MESSAGE                       │
│                    "วันนี้เครียดมากเลย งานเยอะ"                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Route Handler                             │
│                 /app/api/chat/route.ts                          │
│                                                                  │
│  1. Verify authentication                                        │
│  2. Check for pending commands                                   │
│  3. Parse command (if any)                                       │
│  4. Save user message to DB                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Build AI Context (NEW in Phase 1)                   │
│              /lib/ai/context-builder.ts                          │
│                                                                  │
│  buildAIContext(conversationId, message, 50)                     │
│                                                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │  Fetch Recent Messages (50 messages)              │          │
│  │  ├─ Query: chat_messages table                    │          │
│  │  └─ Return: [{role, content}, ...]                │          │
│  └───────────────────────────────────────────────────┘          │
│                           │                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │  Fetch Upcoming Events (next 7 days)              │          │
│  │  ├─ Query: events table                           │          │
│  │  ├─ Filter: event_date between NOW and NOW+7days  │          │
│  │  └─ Return: [{title, date, time, daysUntil}, ...]│          │
│  └───────────────────────────────────────────────────┘          │
│                           │                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │  Fetch Pending Tasks                               │          │
│  │  ├─ Query: event_checklist_items                  │          │
│  │  ├─ Filter: completed = false                     │          │
│  │  └─ Return: [{title, priority}, ...]              │          │
│  └───────────────────────────────────────────────────┘          │
│                           │                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │  Generate Conversation Summary                     │          │
│  │  (if messages > 20)                                │          │
│  │  └─ Analyze topics: นัดหมาย, งาน, บันทึก         │          │
│  └───────────────────────────────────────────────────┘          │
│                           │                                      │
│  Returns AIContext:                                              │
│  {                                                               │
│    recentMessages: [...],                                        │
│    upcomingEvents: [...],                                        │
│    pendingTasks: [...],                                          │
│    conversationSummary: "..."                                    │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Convert Context to Prompt Text                        │
│            /lib/ai/context-utils.ts                              │
│                                                                  │
│  contextToPrompt(aiContext)                                      │
│                                                                  │
│  Generates:                                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │ 📅 นัดหมายที่กำลังจะมาถึง:                       │           │
│  │ - ประชุมทีม (พรุ่งนี้ เวลา 10:00 น.)            │           │
│  │                                                  │           │
│  │ ✓ งานที่รออยู่:                                  │           │
│  │ 🔴 เตรียมเอกสารประชุม (ประชุมทีม)               │           │
│  │                                                  │           │
│  │ 💬 การสนทนาล่าสุดเกี่ยวกับ: นัดหมาย            │           │
│  └──────────────────────────────────────────────────┘           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Detect User Emotion (NEW in Phase 1)                │
│              /lib/ai/context-utils.ts                            │
│                                                                  │
│  detectUserEmotion("วันนี้เครียดมากเลย งานเยอะ")                │
│                                                                  │
│  Checks keywords:                                                │
│  ├─ "เครียด" found in stressedKeywords                          │
│  └─ Returns: { emotion: 'stressed', confidence: 0.8 }           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Generate AI Response with Context                     │
│            /lib/ai/gemini.ts                                     │
│                                                                  │
│  generateAIResponse(                                             │
│    userMessage,                                                  │
│    conversationHistory (50 messages),                            │
│    contextPrompt,        // <- NEW: Events, tasks, summary      │
│    emotionHint          // <- NEW: "stressed"                   │
│  )                                                               │
│                                                                  │
│  Builds full prompt:                                             │
│  ┌──────────────────────────────────────────────────┐           │
│  │ SYSTEM_PROMPT (Enhanced with empathy)            │           │
│  │ ----------------------------------------         │           │
│  │ คุณคือ "Abduloei" ผู้ช่วยอัจฉริยะ...             │           │
│  │ - มีความเข้าอกเข้าใจ รับฟังอย่างตั้งใจ         │           │
│  │ - จำการสนทนาที่ผ่านมาได้                        │           │
│  │                                                  │           │
│  │ === ข้อมูลบริบทเพิ่มเติม ===                      │           │
│  │ 📅 นัดหมายที่กำลังจะมาถึง:                       │           │
│  │ - ประชุมทีม (พรุ่งนี้ เวลา 10:00 น.)            │           │
│  │                                                  │           │
│  │ ✓ งานที่รออยู่:                                  │           │
│  │ 🔴 เตรียมเอกสารประชุม                           │           │
│  │                                                  │           │
│  │ 💡 Emotion Hint: stressed                       │           │
│  │                                                  │           │
│  │ User: วันนี้เครียดมากเลย งานเยอะ                │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
│  Sends to Gemini API (gemini-2.5-flash)                         │
│  ├─ Temperature: 0.85 (creative)                                │
│  ├─ MaxOutputTokens: 1500                                       │
│  └─ Receives AI response                                        │
│                                                                  │
│  Returns: "เข้าใจค่ะว่าตอนนี้งานเยอะ ให้ช่วยอะไรได้บ้างคะ?"    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Add Empathetic Prefix (if strong emotion)                │
│         /app/api/chat/route.ts                                   │
│                                                                  │
│  If emotion === 'stressed' or 'happy':                          │
│    getEmpatheticPrefix('stressed')                               │
│    └─ Returns: "เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด "             │
│                                                                  │
│  Check if AI response already has empathy keywords               │
│  If not, prepend empathetic prefix                               │
│                                                                  │
│  Final response:                                                 │
│  "เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด                            │
│   เข้าใจค่ะว่าตอนนี้งานเยอะ ให้ช่วยอะไรได้บ้างคะ?"             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Save AI Response to Database                     │
│                 /app/actions/chat.ts                             │
│                                                                  │
│  saveChatMessage(conversationId, 'assistant', aiResponse)        │
│  └─ Insert into chat_messages table                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Return Response to Client                     │
│                    /app/api/chat/route.ts                        │
│                                                                  │
│  NextResponse.json({                                             │
│    success: true,                                                │
│    userMessage: {...},                                           │
│    aiMessage: {                                                  │
│      role: 'assistant',                                          │
│      content: "เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด..."           │
│    }                                                             │
│  })                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UI Updates (React)                            │
│                    /components/chat/ChatClient.tsx               │
│                                                                  │
│  Message appears in chat interface with:                         │
│  - Empathetic tone                                               │
│  - Context awareness (mentions upcoming events if relevant)      │
│  - Appropriate emotional response                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Improvements in Phase 1

### Before Phase 1
```
User: "วันนี้เครียดมากเลย งานเยอะ"
AI: "มีอะไรให้ช่วยไหมคะ"
(Generic, no emotion detection, no context)
```

### After Phase 1
```
User: "วันนี้เครียดมากเลย งานเยอะ"
AI: "เข้าใจเลยค่ะว่าตอนนี้รู้สึกเครียด งานเยอะจริงๆ นะคะ
     อ้อ พรุ่งนี้มีประชุมทีมเวลา 10:00 น. นะคะ
     มีอะไรให้ช่วยเตรียมตัวไหมคะ?"
(Empathetic, mentions upcoming event, offers help)
```

---

## Data Flow Summary

1. **User Input** → Saved to DB
2. **Context Building** → Fetch 50 messages, events, tasks (3 queries)
3. **Context Formatting** → Convert to readable text (~200-500 chars)
4. **Emotion Detection** → Analyze keywords, determine emotion
5. **AI Prompt Building** → Combine system prompt + context + emotion
6. **Gemini API Call** → Generate empathetic response
7. **Post-processing** → Add empathetic prefix if needed
8. **Save & Return** → Store in DB, send to client

**Total Time:** 1-3 seconds (mostly Gemini API latency)

---

## Component Responsibilities

### `/lib/ai/context-builder.ts`
- **Purpose:** Gather rich context from database (async operations)
- **Functions:** `buildAIContext()`
- **Queries:** Messages, events, tasks
- **Returns:** AIContext object

### `/lib/ai/context-utils.ts`
- **Purpose:** Utility functions for context processing (sync operations)
- **Functions:** `contextToPrompt()`, `detectUserEmotion()`, `getEmpatheticPrefix()`
- **Processing:** Text analysis, formatting
- **Returns:** Formatted strings, emotion data

### `/lib/ai/gemini.ts`
- **Purpose:** Interface with Google Gemini API
- **Changes:** Enhanced SYSTEM_PROMPT, added context parameters
- **Processing:** Build full prompt, call Gemini, return response
- **Returns:** AI-generated text

### `/app/api/chat/route.ts`
- **Purpose:** Main API orchestration
- **Responsibilities:** Auth, validation, context building, AI generation, response formatting
- **Integration:** Ties everything together
- **Returns:** JSON response to client

---

## Database Queries per Request

```
┌─────────────────────────────────────────────────┐
│ Query 1: Fetch Recent Messages                  │
│ Table: chat_messages                             │
│ Filter: conversation_id = X                      │
│ Limit: 50                                        │
│ Order: created_at DESC                           │
│ Time: ~50ms                                      │
└─────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────┐
│ Query 2: Fetch User Events                      │
│ Table: events                                    │
│ Filter: user_id = X, event_date BETWEEN NOW+7   │
│ Join: event_checklist_items                      │
│ Time: ~30ms                                      │
└─────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────┐
│ Query 3: (Implicit) Fetch Checklist Items       │
│ Table: event_checklist_items                     │
│ Filter: event_id IN (...), completed = false     │
│ Time: ~20ms                                      │
└─────────────────────────────────────────────────┘

Total DB time: ~100ms
```

---

## Emotion Detection Logic

```
┌─────────────────────────────────────────────────┐
│ Input: "วันนี้เครียดมากเลย งานเยอะ"              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Convert to lowercase                             │
│ "วันนี้เครียดมากเลย งานเยอะ"                    │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Check against keyword arrays:                    │
│                                                  │
│ stressedKeywords = [                             │
│   'เครียด', 'กังวล', 'ไม่รู้จะทำยังไง',         │
│   'ช่วยด้วย', 'ยุ่ง', 'วุ่นวาย'                 │
│ ]                                                │
│                                                  │
│ Found: "เครียด" ✅                               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ Return: {                                        │
│   emotion: 'stressed',                           │
│   confidence: 0.8                                │
│ }                                                │
└─────────────────────────────────────────────────┘
```

---

## Example Context Prompt

```
=== ข้อมูลบริบทเพิ่มเติม ===
📅 นัดหมายที่กำลังจะมาถึง:
- ประชุมทีม (พรุ่งนี้ เวลา 10:00 น.)
- งานเลี้ยงครอบครัว (อีก 3 วัน เวลา 18:00 น.)
- ตรวจสุขภาพประจำปี (อีก 5 วัน เวลา 09:00 น.)

✓ งานที่รอการทำ:
🔴 เตรียมเอกสารประชุม (ประชุมทีม)
🟡 ซื้อของขวัญ (งานเลี้ยงครอบครัว)
🟢 ทำรายการตรวจ (ตรวจสุขภาพประจำปี)

💬 การสนทนาล่าสุดเกี่ยวกับ: นัดหมาย, งาน
```

This context helps AI:
1. Mention upcoming events proactively
2. Suggest completing pending tasks
3. Reference previous conversations
4. Provide more relevant, helpful responses

---

**Visual Guide Complete - Phase 1 Architecture**
