import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailySummary, generateReminders } from '@/lib/ai/proactive-engine';
import { saveChatMessage } from '@/lib/db/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proactive API endpoint - Called by cron job to send daily summaries and reminders
 * Requires authorization via CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from authorized source (cron job or internal service)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Get all users with active conversations
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('id, user_id')
      .limit(100); // Process in batches

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No conversations found',
      });
    }

    let processed = 0;
    const errors: string[] = [];

    const hour = new Date().getHours();

    for (const conv of conversations) {
      try {
        // Generate daily summary (only at 7 AM)
        if (hour === 7) {
          const summary = await generateDailySummary(conv.user_id);

          // Save summary as AI message in conversation
          await saveChatMessage(conv.id, 'assistant', summary);
          processed++;
        }

        // Send reminders for upcoming events (every hour between 6 AM - 10 PM)
        if (hour >= 6 && hour <= 22) {
          const reminders = await generateReminders(conv.user_id);

          if (reminders.length > 0) {
            const reminderMessage = reminders.join('\n');
            await saveChatMessage(conv.id, 'assistant', reminderMessage);
            processed++;
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${conv.user_id}:`, userError);
        errors.push(`User ${conv.user_id}: ${userError}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      total: conversations.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Proactive API error:', error);
    return NextResponse.json(
      {
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Proactive AI endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
