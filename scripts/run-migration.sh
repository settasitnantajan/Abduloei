#!/bin/bash

# Run Supabase Migration Script
# Usage: ./scripts/run-migration.sh

echo "🔄 Running Event & Checklist Migration..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

# Load environment variables
source .env.local

# Check if SUPABASE_URL is set
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL not found in .env.local"
    exit 1
fi

echo "📋 Migration file: supabase/migrations/20260311120031_create_events_and_checklist.sql"
echo "🌐 Supabase URL: $SUPABASE_URL"
echo ""
echo "⚠️  To run this migration, please use one of these methods:"
echo ""
echo "Method 1: Supabase Dashboard (Recommended)"
echo "  1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new"
echo "  2. Copy the content from: supabase/migrations/20260311120031_create_events_and_checklist.sql"
echo "  3. Paste and run the SQL"
echo ""
echo "Method 2: Supabase CLI"
echo "  1. Install: npm install -g supabase"
echo "  2. Login: supabase login"
echo "  3. Link project: supabase link --project-ref YOUR_PROJECT_REF"
echo "  4. Run: supabase db push"
echo ""
echo "Method 3: psql (if you have PostgreSQL client)"
echo "  1. Get your database URL from Supabase Dashboard"
echo "  2. Run: psql 'postgresql://...' -f supabase/migrations/20260311120031_create_events_and_checklist.sql"
echo ""
