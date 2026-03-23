# LINE Integration Documentation

## Overview

Abduloei integrates with LINE Messaging API to send automated notifications to users in Thai language. This includes daily summaries and event reminders.

## LINE Messaging API Setup

### 1. Create LINE Developer Account

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Login with your LINE account
3. Create a new Provider (e.g., "Abduloei")
4. Create a new Messaging API Channel

### 2. Get Required Credentials

From your LINE Channel settings, obtain:
- **Channel ID**: Used for LINE Login OAuth
- **Channel Secret**: Used to verify webhook signatures
- **Channel Access Token**: Used to send messages (long-lived token recommended)

### 3. Configure Environment Variables

Add to your `.env.local`:

```env
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CALLBACK_URL=https://your-domain.com/api/line/callback
```

## Database Schema

### line_connections Table

Stores user LINE account connections:

```sql
create table line_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  line_user_id text unique not null,
  display_name text,
  picture_url text,
  status_message text,
  is_active boolean default true,
  connected_at timestamp default now(),
  last_notified_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Index for faster lookups
create index idx_line_connections_user_id on line_connections(user_id);
create index idx_line_connections_line_user_id on line_connections(line_user_id);

-- RLS Policies
alter table line_connections enable row level security;

create policy "Users can view their own LINE connections"
on line_connections for select
using (auth.uid() = user_id);

create policy "Users can insert their own LINE connections"
on line_connections for insert
with check (auth.uid() = user_id);

create policy "Users can update their own LINE connections"
on line_connections for update
using (auth.uid() = user_id);

create policy "Users can delete their own LINE connections"
on line_connections for delete
using (auth.uid() = user_id);
```

### notification_settings Table

User-specific notification preferences:

```sql
create table notification_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,

  -- Daily Summary Settings
  daily_summary_enabled boolean default true,
  daily_summary_time time default '08:00',

  -- Event Reminder Settings
  event_reminder_enabled boolean default true,
  event_reminder_minutes integer default 5,

  -- Task Reminder Settings
  task_reminder_enabled boolean default true,
  task_due_reminder_enabled boolean default true,
  task_due_reminder_time time default '09:00',

  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- RLS Policies
alter table notification_settings enable row level security;

create policy "Users can view their own notification settings"
on notification_settings for select
using (auth.uid() = user_id);

create policy "Users can update their own notification settings"
on notification_settings for update
using (auth.uid() = user_id);

create policy "Users can insert their own notification settings"
on notification_settings for insert
with check (auth.uid() = user_id);
```

## OAuth Flow - Connecting LINE Account

### 1. Redirect User to LINE Login

```typescript
// app/settings/line/page.tsx
export default function LineConnectionPage() {
  const handleConnect = () => {
    const state = generateRandomState(); // CSRF protection
    sessionStorage.setItem('line_oauth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_LINE_CALLBACK_URL!,
      state: state,
      scope: 'profile openid',
    });

    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params}`;
  };

  return (
    <button onClick={handleConnect}>
      เชื่อมต่อกับ LINE
    </button>
  );
}
```

### 2. Handle OAuth Callback

```typescript
// app/api/line/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state for CSRF protection
  // (in production, check against stored state)

  if (!code) {
    return NextResponse.redirect('/settings?error=no_code');
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.LINE_CALLBACK_URL!,
      client_id: process.env.LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!,
    }),
  });

  const tokenData = await tokenResponse.json();

  // Get user profile
  const profileResponse = await fetch('https://api.line.me/v2/profile', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const profile = await profileResponse.json();

  // Save to database
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect('/login');
  }

  await supabase.from('line_connections').upsert({
    user_id: user.id,
    line_user_id: profile.userId,
    display_name: profile.displayName,
    picture_url: profile.pictureUrl,
    status_message: profile.statusMessage,
    is_active: true,
    connected_at: new Date().toISOString(),
  });

  return NextResponse.redirect('/settings?success=line_connected');
}
```

## Notification Types

### 1. Daily Summary (08:00 AM)

Sends a summary of events and tasks for the day:

```typescript
// lib/line/notifications.ts
export async function sendDailySummary(lineUserId: string, summary: DailySummary) {
  const message = {
    type: 'flex',
    altText: 'สรุปกิจกรรมวันนี้',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📅 สรุปกิจกรรมวันนี้',
            weight: 'bold',
            size: 'xl',
            color: '#ffffff',
          },
          {
            type: 'text',
            text: new Date().toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            size: 'sm',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#0084FF',
        paddingAll: '20px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📌 กิจกรรมวันนี้',
            weight: 'bold',
            size: 'md',
            margin: 'md',
          },
          ...summary.events.map(event => ({
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: event.time,
                size: 'sm',
                color: '#999999',
                flex: 0,
              },
              {
                type: 'text',
                text: event.title,
                size: 'sm',
                wrap: true,
              },
            ],
            margin: 'md',
          })),
          {
            type: 'separator',
            margin: 'xl',
          },
          {
            type: 'text',
            text: '✅ งานที่ต้องทำ',
            weight: 'bold',
            size: 'md',
            margin: 'xl',
          },
          ...summary.tasks.map(task => ({
            type: 'text',
            text: `• ${task.title}`,
            size: 'sm',
            wrap: true,
            margin: 'md',
          })),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'เปิด Abduloei',
              uri: process.env.NEXT_PUBLIC_APP_URL!,
            },
            style: 'primary',
          },
        ],
      },
    },
  };

  await sendLineMessage(lineUserId, message);
}
```

### 2. Event Reminder (5 minutes before)

Sends alert before an event starts:

```typescript
export async function sendEventReminder(lineUserId: string, event: Event) {
  const message = {
    type: 'flex',
    altText: `เตือน: ${event.title} ในอีก 5 นาที`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '⏰ แจ้งเตือนกิจกรรม',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff',
          },
        ],
        backgroundColor: '#FF6B6B',
        paddingAll: '15px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: event.title,
            weight: 'bold',
            size: 'xl',
            wrap: true,
          },
          {
            type: 'text',
            text: '🕐 เริ่มในอีก 5 นาที',
            size: 'md',
            color: '#FF6B6B',
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📝 รายละเอียด',
                weight: 'bold',
                size: 'sm',
                color: '#999999',
              },
              {
                type: 'text',
                text: event.description || 'ไม่มีรายละเอียด',
                size: 'sm',
                wrap: true,
                margin: 'sm',
              },
            ],
            margin: 'lg',
          },
        ],
      },
    },
  };

  await sendLineMessage(lineUserId, message);
}
```

### 3. Task Due Reminder

Reminds about tasks due today:

```typescript
export async function sendTaskDueReminder(lineUserId: string, tasks: Task[]) {
  const message = {
    type: 'text',
    text: `📋 คุณมีงาน ${tasks.length} งานที่ครบกำหนดวันนี้:\n\n${tasks.map(t => `• ${t.title}`).join('\n')}\n\nเปิด Abduloei เพื่อดูรายละเอียด`,
  };

  await sendLineMessage(lineUserId, message);
}
```

## Sending Messages

### Core Function

```typescript
// lib/line/client.ts
export async function sendLineMessage(lineUserId: string, message: any) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [message],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('LINE API Error:', error);
    throw new Error(`Failed to send LINE message: ${error.message}`);
  }

  return response.json();
}
```

## Cron Jobs - Automated Notifications

### Using Vercel Cron Jobs

Create API routes that will be triggered by Vercel Cron:

```typescript
// app/api/cron/daily-summary/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendDailySummary } from '@/lib/line/notifications';

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Get current time in Thailand timezone
  const now = new Date();
  const thaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const currentTime = thaiTime.toTimeString().slice(0, 5); // HH:MM

  // Find users who want daily summary at this time
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('user_id, daily_summary_time')
    .eq('daily_summary_enabled', true)
    .eq('daily_summary_time', currentTime);

  if (!settings || settings.length === 0) {
    return NextResponse.json({ message: 'No users to notify' });
  }

  const results = [];

  for (const setting of settings) {
    try {
      // Get user's LINE connection
      const { data: lineConnection } = await supabase
        .from('line_connections')
        .select('line_user_id')
        .eq('user_id', setting.user_id)
        .eq('is_active', true)
        .single();

      if (!lineConnection) continue;

      // Get user's homes
      const { data: homeMembers } = await supabase
        .from('home_members')
        .select('home_id')
        .eq('user_id', setting.user_id);

      const homeIds = homeMembers?.map(hm => hm.home_id) || [];

      // Get today's events
      const today = thaiTime.toISOString().split('T')[0];
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .in('home_id', homeIds)
        .eq('date', today)
        .order('time', { ascending: true });

      // Get pending tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .in('home_id', homeIds)
        .eq('status', 'pending')
        .lte('due_date', today)
        .order('due_date', { ascending: true });

      // Send notification
      await sendDailySummary(lineConnection.line_user_id, {
        events: events || [],
        tasks: tasks || [],
      });

      // Update last notified timestamp
      await supabase
        .from('line_connections')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('user_id', setting.user_id);

      results.push({ user_id: setting.user_id, status: 'sent' });
    } catch (error) {
      console.error(`Error sending to user ${setting.user_id}:`, error);
      results.push({ user_id: setting.user_id, status: 'error', error: error.message });
    }
  }

  return NextResponse.json({ results });
}
```

### Event Reminder Cron Job

```typescript
// app/api/cron/event-reminders/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEventReminder } from '@/lib/line/notifications';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Get current time in Thailand timezone
  const now = new Date();
  const thaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

  // Calculate time range (5-6 minutes from now)
  const reminderTime = new Date(thaiNow.getTime() + 5 * 60 * 1000);
  const reminderTimeEnd = new Date(thaiNow.getTime() + 6 * 60 * 1000);

  const today = thaiNow.toISOString().split('T')[0];
  const reminderTimeStr = reminderTime.toTimeString().slice(0, 5);
  const reminderTimeEndStr = reminderTimeEnd.toTimeString().slice(0, 5);

  // Find events starting in 5 minutes
  const { data: events } = await supabase
    .from('events')
    .select('*, home:homes(id), home_members!inner(user_id)')
    .eq('date', today)
    .gte('time', reminderTimeStr)
    .lt('time', reminderTimeEndStr);

  if (!events || events.length === 0) {
    return NextResponse.json({ message: 'No events to remind' });
  }

  const results = [];

  // Group events by user
  const eventsByUser = new Map();
  for (const event of events) {
    const homeMembers = event.home_members;
    for (const member of homeMembers) {
      if (!eventsByUser.has(member.user_id)) {
        eventsByUser.set(member.user_id, []);
      }
      eventsByUser.get(member.user_id).push(event);
    }
  }

  // Send reminders
  for (const [userId, userEvents] of eventsByUser) {
    try {
      // Check if user has reminders enabled
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('event_reminder_enabled')
        .eq('user_id', userId)
        .single();

      if (!settings?.event_reminder_enabled) continue;

      // Get LINE connection
      const { data: lineConnection } = await supabase
        .from('line_connections')
        .select('line_user_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!lineConnection) continue;

      // Send reminder for each event
      for (const event of userEvents) {
        await sendEventReminder(lineConnection.line_user_id, event);
      }

      results.push({ user_id: userId, events: userEvents.length, status: 'sent' });
    } catch (error) {
      console.error(`Error sending to user ${userId}:`, error);
      results.push({ user_id: userId, status: 'error', error: error.message });
    }
  }

  return NextResponse.json({ results });
}
```

### Configure Vercel Cron

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/event-reminders",
      "schedule": "* * * * *"
    }
  ]
}
```

The daily summary runs every hour and checks which users need notifications at that time. Event reminders run every minute to check for upcoming events.

## Rate Limits

LINE Messaging API Free Plan limits:
- **Push messages**: 1,000 messages/month
- **Reply messages**: Unlimited (but requires user to message bot first)
- **Multicast**: 500 messages/month

### Optimization Strategies

1. **Batch notifications**: Combine multiple events in one message
2. **Smart filtering**: Only send notifications for important events
3. **User preferences**: Allow users to configure notification frequency
4. **Rate limiting**: Track monthly usage and warn users

```typescript
// lib/line/rate-limiter.ts
export async function checkRateLimit(userId: string): Promise<boolean> {
  const supabase = createClient();

  // Count messages sent this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('line_messages_log')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', startOfMonth.toISOString());

  return (count || 0) < 1000;
}
```

## Testing

### Test LINE Connection

```typescript
// app/api/line/test/route.ts
export async function POST(request: Request) {
  const { lineUserId, message } = await request.json();

  try {
    await sendLineMessage(lineUserId, {
      type: 'text',
      text: message || 'ทดสอบการเชื่อมต่อ LINE สำเร็จ! ✅',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Manual Trigger for Testing

```typescript
// app/api/line/trigger-daily-summary/route.ts
export async function POST(request: Request) {
  const { userId } = await request.json();

  // Manual trigger for testing (requires auth)
  // ... implementation
}
```

## Debugging

### Enable Logging

```typescript
// lib/line/logger.ts
export async function logLineMessage(
  userId: string,
  lineUserId: string,
  messageType: string,
  success: boolean,
  error?: string
) {
  const supabase = createClient();

  await supabase.from('line_messages_log').insert({
    user_id: userId,
    line_user_id: lineUserId,
    message_type: messageType,
    success: success,
    error_message: error,
    sent_at: new Date().toISOString(),
  });
}
```

### Check Webhook Events

LINE can send webhook events (e.g., when user blocks/unblocks bot):

```typescript
// app/api/line/webhook/route.ts
import crypto from 'crypto';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature');

  // Verify signature
  const hash = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64');

  if (hash !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const events = JSON.parse(body).events;

  for (const event of events) {
    if (event.type === 'unfollow') {
      // User blocked the bot - deactivate connection
      await supabase
        .from('line_connections')
        .update({ is_active: false })
        .eq('line_user_id', event.source.userId);
    } else if (event.type === 'follow') {
      // User added bot - activate connection
      await supabase
        .from('line_connections')
        .update({ is_active: true })
        .eq('line_user_id', event.source.userId);
    }
  }

  return NextResponse.json({ success: true });
}
```

## Security Considerations

1. **Never expose Channel Secret**: Keep in environment variables only
2. **Verify webhook signatures**: Always validate LINE webhook requests
3. **Use HTTPS**: LINE API requires HTTPS endpoints
4. **Rate limiting**: Implement usage tracking to avoid quota exhaustion
5. **User privacy**: Store only necessary LINE profile data
6. **CSRF protection**: Use state parameter in OAuth flow
7. **Token rotation**: Implement refresh token mechanism for long-term access

## Cost Estimate

Based on 2 users with moderate usage:
- Daily summaries: 2 users × 30 days = 60 messages/month
- Event reminders: ~20-40 messages/month
- Task reminders: ~10-20 messages/month

**Total**: ~90-120 messages/month (well within 1,000 free limit)

## Troubleshooting

### Common Issues

1. **Messages not sending**
   - Check Channel Access Token is valid
   - Verify user hasn't blocked the bot
   - Check rate limits haven't been exceeded
   - Ensure LINE connection is active in database

2. **OAuth connection fails**
   - Verify callback URL matches exactly in LINE Console
   - Check Channel ID and Secret are correct
   - Ensure redirect URI is HTTPS (required by LINE)

3. **Wrong timezone**
   - Always use 'Asia/Bangkok' timezone for Thai users
   - Convert dates properly when comparing times

4. **Cron jobs not running**
   - Verify Vercel Cron is configured correctly
   - Check CRON_SECRET is set in environment variables
   - Review Vercel function logs for errors

## References

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [LINE Login Documentation](https://developers.line.biz/en/docs/line-login/)
- [Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
