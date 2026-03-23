# Quick Start: AI Upgrade (Phase 2-5)

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migrations (1 min)

```bash
# Navigate to project directory
cd /Users/duke/Documents/abduloei

# Apply migrations
supabase db push

# Or if you prefer manual:
supabase db reset  # This will run all migrations
```

**Verify tables created:**
```bash
supabase db inspect
```

Expected tables:
- `user_profiles`
- `user_memories`
- `ai_scheduled_actions`

---

### Step 2: Set Environment Variables (1 min)

Add to `.env.local`:

```bash
# Already have these:
GEMINI_API_KEY=your_existing_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# NEW - Add these:
CRON_SECRET=generate_random_string_here
NEXT_PUBLIC_URL=http://localhost:3000  # or your production URL
```

Generate CRON_SECRET:
```bash
# macOS/Linux
openssl rand -base64 32
```

---

### Step 3: Restart Your App (30 seconds)

```bash
# Kill existing process
pkill -f "next dev"

# Restart
npm run dev
```

---

### Step 4: Test Memory System (2 min)

1. **Go to chat**: http://localhost:3000/chat
2. **Send message**: "ชื่อแม่ผมคือสมหญิง"
3. **Check memories**: http://localhost:3000/profile/memories
4. **Verify**: Should see family memory with "แม่_name: สมหญิง"

---

### Step 5: Test Web Search (30 seconds)

In chat, send:
```
"ราคา iPhone 15 เท่าไหร่"
```

Expected: AI searches web and returns price information with sources.

---

## ✅ That's it! You're done!

### What's New:

1. **Long-term Memory** 🧠
   - AI remembers everything you tell it
   - View memories at `/profile/memories`
   - Automatic extraction from conversations

2. **Web Search** 🔍
   - Ask about prices, news, weather
   - AI searches and cites sources
   - Real-time information

3. **Proactive Features** 🤖
   - Daily summaries (7 AM)
   - Event reminders
   - Smart suggestions

4. **Memory Management UI** 💎
   - View all memories
   - Delete unwanted memories
   - Beautiful categorized display

---

## Test It Out

### Memory Extraction Examples:

```
"ชื่อแม่ผมคือสมหญิง" → Family memory
"ผมชอบกินข้าวผัด" → Preference memory
"ผมวิ่งทุกเช้า" → Habit memory
"อยากเรียนภาษาญี่ปุ่น" → Goal memory
"วันเกิดแม่ 15 มีนาคม" → Important date
```

### Web Search Examples:

```
"ราคา iPhone 15 เท่าไหร่"
"ข่าวล่าสุดวันนี้"
"อากาศกรุงเทพวันนี้"
"ราคาหุ้นตอนนี้"
"ผลบอลเมื่อคืน"
```

---

## Optional: Setup Proactive Features (Cron)

If you want daily summaries and reminders:

### Option 1: Vercel Cron (Easiest)

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/proactive",
    "schedule": "0 * * * *"
  }]
}
```

Deploy to Vercel:
```bash
vercel deploy
```

### Option 2: Supabase Edge Function

```bash
# Deploy edge function
supabase functions deploy proactive-cron

# Set environment variables in Supabase Dashboard:
# - NEXT_PUBLIC_URL
# - CRON_SECRET

# Create cron job in Supabase SQL Editor:
```
```sql
SELECT cron.schedule(
  'proactive-ai',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='YOUR_SUPABASE_URL/functions/v1/proactive-cron',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

### Option 3: Manual Trigger (Testing)

```bash
curl -X POST http://localhost:3000/api/proactive \
  -H "Authorization: Bearer your_cron_secret"
```

---

## Troubleshooting

### Migration Errors

```bash
# Reset and try again
supabase db reset

# Check migration status
supabase migration list
```

### Memory Not Extracted

Check console logs:
```bash
# Should see:
Memory extraction error: [details]
```

Common issues:
- Pattern didn't match (update patterns in `memory-manager.ts`)
- User not authenticated (check session)

### Web Search Not Working

1. Check GEMINI_API_KEY is set
2. Verify API quota not exceeded
3. Check console for errors

### Proactive API 401 Error

- Verify CRON_SECRET matches in `.env.local` and request
- Check Authorization header format

---

## File Locations

Quick reference for editing:

```
Memory System:
- /lib/ai/memory-manager.ts
- /app/actions/memories.ts
- /app/profile/memories/page.tsx
- /components/memories/MemoryList.tsx

Web Search:
- /lib/ai/search-detector.ts
- /lib/ai/web-searcher.ts

Proactive AI:
- /lib/ai/proactive-engine.ts
- /app/api/proactive/route.ts

Context Builder:
- /lib/ai/context-builder.ts
- /lib/ai/context-utils.ts

Main Chat:
- /app/api/chat/route.ts

Migrations:
- /supabase/migrations/20260312130000_add_memory_system.sql
- /supabase/migrations/20260312140000_add_proactive_features.sql
```

---

## Next Steps

1. **Test all features** (see TESTING-GUIDE.md)
2. **Customize memory patterns** (add your own extraction rules)
3. **Setup cron jobs** (for proactive features)
4. **Deploy to production** (Vercel + Supabase)

---

## Need Help?

- Full documentation: `/docs/AI-UPGRADE-COMPLETE.md`
- Testing guide: `/docs/TESTING-GUIDE.md`
- Check console logs for errors
- Review Supabase logs in dashboard

---

**Status:** Ready to use! 🎉
**Last Updated:** 2026-03-12
