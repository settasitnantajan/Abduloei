// NOTE: This client is for browser use only
// For this project, we're using server-side only approach
// If you need client-side access, you'll need to expose NEXT_PUBLIC_* env vars

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // This will throw an error if used because we don't have NEXT_PUBLIC_ vars
  // Use server.ts createClient() instead in Server Components
  throw new Error('Client-side Supabase is disabled for security. Use server-side client only.')
}
