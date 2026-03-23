import { createClient } from '@/lib/supabase/server'

export default async function TestConnectionPage() {
  let connectionStatus = {
    success: false,
    message: '',
    projectUrl: '',
    error: null as string | null,
    tables: [] as string[],
  }

  try {
    const supabase = await createClient()

    // Test 1: Check if client is created
    if (!supabase) {
      throw new Error('Failed to create Supabase client')
    }

    connectionStatus.projectUrl = process.env.SUPABASE_URL || ''

    // Test 2: Try a simple RPC call to check connection
    // This is safer than trying to query tables
    const { error: pingError } = await supabase.rpc('pg_backend_pid')

    if (pingError) {
      // If RPC doesn't work, connection might still be valid but no functions exist yet
      // Check if it's a "function does not exist" error (which means connection works)
      if (
        pingError.message.includes('function') ||
        pingError.message.includes('does not exist')
      ) {
        connectionStatus.success = true
        connectionStatus.message =
          'Connection successful! (No database objects created yet)'
      } else {
        throw pingError
      }
    } else {
      connectionStatus.success = true
      connectionStatus.message = 'Connection successful!'
    }

    // Try to get table list (might fail if no tables exist)
    try {
      const { data: tables } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public')

      if (tables && tables.length > 0) {
        connectionStatus.tables = tables.map((t: any) => t.tablename)
        connectionStatus.message = `Connection successful! Found ${connectionStatus.tables.length} tables`
      }
    } catch {
      // Ignore table listing errors
    }
  } catch (error: any) {
    connectionStatus.success = false
    connectionStatus.error = error.message || 'Unknown error'
    connectionStatus.message = 'Connection failed'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">
          🧪 Supabase Connection Test
        </h1>

        {/* Connection Status */}
        <div
          className={`p-6 rounded-lg shadow-md mb-6 ${
            connectionStatus.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">
              {connectionStatus.success ? '✅' : '❌'}
            </span>
            <div>
              <h2 className="text-xl font-bold">
                {connectionStatus.success
                  ? 'Connection Successful!'
                  : 'Connection Failed'}
              </h2>
              <p className="text-sm text-gray-600">
                {connectionStatus.message}
              </p>
            </div>
          </div>

          {connectionStatus.error && (
            <div className="mt-4 p-4 bg-red-100 rounded border border-red-300">
              <p className="text-sm font-mono text-red-800">
                <strong>Error:</strong> {connectionStatus.error}
              </p>
            </div>
          )}
        </div>

        {/* Connection Details */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">
            📋 Connection Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">Project URL:</span>
              <span className="text-sm font-mono text-gray-900">
                {connectionStatus.projectUrl || 'Not configured'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">Client Type:</span>
              <span className="text-sm text-gray-900">
                Server-side (Next.js App Router)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">
                Authentication:
              </span>
              <span className="text-sm text-gray-900">
                Using Supabase SSR (@supabase/ssr)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-700">Status:</span>
              <span
                className={`text-sm font-bold ${
                  connectionStatus.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {connectionStatus.success ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </div>

        {/* Database Tables */}
        {connectionStatus.success && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-4 text-gray-900">
              🗄️ Database Tables
            </h3>
            {connectionStatus.tables.length > 0 ? (
              <div className="space-y-2">
                {connectionStatus.tables.map((table) => (
                  <div
                    key={table}
                    className="py-2 px-4 bg-blue-50 rounded border border-blue-200"
                  >
                    <span className="font-mono text-sm text-blue-900">
                      {table}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">📦 No tables found</p>
                <p className="text-sm">
                  Database is connected but no tables have been created yet.
                </p>
                <p className="text-sm mt-2">
                  Run the SQL migrations in Supabase Dashboard to create
                  tables.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Next Steps */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-bold mb-3 text-blue-900">
            🚀 Next Steps
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
            <li>
              Go to Supabase Dashboard → SQL Editor to create database tables
            </li>
            <li>
              Run the SQL script from <code>DATABASE-SCHEMA.md</code>
            </li>
            <li>Refresh this page to see the created tables</li>
            <li>
              Check <code>SUPABASE-CONNECTION.md</code> for connection
              documentation
            </li>
          </ul>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
