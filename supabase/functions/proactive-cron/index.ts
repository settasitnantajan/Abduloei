import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * Supabase Edge Function for Proactive AI Cron Job
 *
 * This function should be scheduled to run hourly using Supabase Cron.
 * It calls the Next.js proactive API to send daily summaries and reminders.
 *
 * Setup:
 * 1. Deploy this edge function: supabase functions deploy proactive-cron
 * 2. Set environment variables in Supabase dashboard:
 *    - NEXT_PUBLIC_URL: Your Next.js app URL
 *    - CRON_SECRET: Secret key for authentication
 * 3. Create a cron job in Supabase dashboard to run this function hourly
 */

serve(async (req) => {
  try {
    const nextAppUrl = Deno.env.get('NEXT_PUBLIC_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!nextAppUrl) {
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'NEXT_PUBLIC_URL not configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!cronSecret) {
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          message: 'CRON_SECRET not configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call the Next.js proactive API
    const response = await fetch(`${nextAppUrl}/api/proactive`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);

    return new Response(
      JSON.stringify({
        error: 'Execution error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
