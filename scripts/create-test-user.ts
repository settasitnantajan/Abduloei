import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

interface CreateUserResult {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

async function createTestUser(): Promise<CreateUserResult> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      success: false,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables'
    }
  }

  // Create admin client with Service Role Key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const testEmail = 'test@abduloei.com'
  const testPassword = '123456'

  console.log('\n=== Creating Test User ===\n')
  console.log(`Email: ${testEmail}`)
  console.log(`Password: ${testPassword}`)
  console.log('\nAttempting to create user...\n')

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === testEmail)

    if (existingUser) {
      console.log('⚠️  User already exists!')
      console.log(`User ID: ${existingUser.id}`)
      console.log(`Email: ${existingUser.email}`)
      console.log(`Created at: ${existingUser.created_at}`)
      console.log(`Email confirmed: ${existingUser.email_confirmed_at ? 'Yes' : 'No'}`)

      return {
        success: true,
        userId: existingUser.id,
        email: existingUser.email,
        error: 'User already exists'
      }
    }

    // Create new user
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: 'Test User',
        created_by: 'create-test-user-script'
      }
    })

    if (error) {
      console.error('❌ Error creating user:', error.message)
      return {
        success: false,
        error: error.message
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: 'No user data returned'
      }
    }

    console.log('✅ Test user created successfully!\n')
    console.log('=== User Details ===')
    console.log(`User ID: ${data.user.id}`)
    console.log(`Email: ${data.user.email}`)
    console.log(`Created at: ${data.user.created_at}`)
    console.log(`Email confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`)
    console.log('\n=== Login Credentials ===')
    console.log(`Email: ${testEmail}`)
    console.log(`Password: ${testPassword}`)
    console.log('\n=== Test Login ===')
    console.log('1. Open http://localhost:3000/login')
    console.log('2. Enter the credentials above')
    console.log('3. Click "เข้าสู่ระบบ"')

    return {
      success: true,
      userId: data.user.id,
      email: data.user.email
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Run the script
createTestUser()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ Script completed successfully')
      process.exit(0)
    } else {
      console.error('\n❌ Script failed:', result.error)
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  })
