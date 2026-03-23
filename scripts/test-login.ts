import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

interface TestResult {
  test: string
  passed: boolean
  message?: string
  details?: any
}

async function testLogin(): Promise<TestResult[]> {
  const results: TestResult[] = []

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    results.push({
      test: 'Environment Variables',
      passed: false,
      message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
    })
    return results
  }

  results.push({
    test: 'Environment Variables',
    passed: true,
    message: 'All required environment variables are set'
  })

  // Create client (same as the app uses)
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const testEmail = 'test@abduloei.com'
  const testPassword = '123456'

  console.log('\n=== Testing Login System ===\n')

  // Test 1: Login with correct credentials
  console.log('Test 1: Login with correct credentials')
  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (loginError) {
      results.push({
        test: 'Login with correct credentials',
        passed: false,
        message: loginError.message,
        details: loginError
      })
      console.log('❌ Failed:', loginError.message)
    } else if (loginData.user) {
      results.push({
        test: 'Login with correct credentials',
        passed: true,
        message: 'Successfully logged in',
        details: {
          userId: loginData.user.id,
          email: loginData.user.email,
          hasSession: !!loginData.session
        }
      })
      console.log('✅ Passed')
      console.log(`   User ID: ${loginData.user.id}`)
      console.log(`   Email: ${loginData.user.email}`)
      console.log(`   Has session: ${!!loginData.session}`)

      // Sign out for next tests
      await supabase.auth.signOut()
    } else {
      results.push({
        test: 'Login with correct credentials',
        passed: false,
        message: 'No user data returned'
      })
      console.log('❌ Failed: No user data returned')
    }
  } catch (error) {
    results.push({
      test: 'Login with correct credentials',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    console.log('❌ Failed:', error)
  }

  // Test 2: Login with incorrect password
  console.log('\nTest 2: Login with incorrect password')
  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'wrongpassword',
    })

    if (loginError) {
      results.push({
        test: 'Login with incorrect password (should fail)',
        passed: true,
        message: 'Correctly rejected invalid password',
        details: { errorMessage: loginError.message }
      })
      console.log('✅ Passed - Correctly rejected invalid password')
    } else {
      results.push({
        test: 'Login with incorrect password (should fail)',
        passed: false,
        message: 'Should have rejected incorrect password but succeeded'
      })
      console.log('❌ Failed: Should have rejected incorrect password')
    }
  } catch (error) {
    results.push({
      test: 'Login with incorrect password (should fail)',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    console.log('❌ Failed:', error)
  }

  // Test 3: Login with non-existent email
  console.log('\nTest 3: Login with non-existent email')
  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@abduloei.com',
      password: testPassword,
    })

    if (loginError) {
      results.push({
        test: 'Login with non-existent email (should fail)',
        passed: true,
        message: 'Correctly rejected non-existent email',
        details: { errorMessage: loginError.message }
      })
      console.log('✅ Passed - Correctly rejected non-existent email')
    } else {
      results.push({
        test: 'Login with non-existent email (should fail)',
        passed: false,
        message: 'Should have rejected non-existent email but succeeded'
      })
      console.log('❌ Failed: Should have rejected non-existent email')
    }
  } catch (error) {
    results.push({
      test: 'Login with non-existent email (should fail)',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    console.log('❌ Failed:', error)
  }

  // Test 4: Login with empty credentials
  console.log('\nTest 4: Login with empty credentials')
  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: '',
      password: '',
    })

    if (loginError) {
      results.push({
        test: 'Login with empty credentials (should fail)',
        passed: true,
        message: 'Correctly rejected empty credentials',
        details: { errorMessage: loginError.message }
      })
      console.log('✅ Passed - Correctly rejected empty credentials')
    } else {
      results.push({
        test: 'Login with empty credentials (should fail)',
        passed: false,
        message: 'Should have rejected empty credentials but succeeded'
      })
      console.log('❌ Failed: Should have rejected empty credentials')
    }
  } catch (error) {
    results.push({
      test: 'Login with empty credentials (should fail)',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    console.log('❌ Failed:', error)
  }

  // Test 5: Verify session management
  console.log('\nTest 5: Session management')
  try {
    // Login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })

    if (loginError) {
      results.push({
        test: 'Session management',
        passed: false,
        message: 'Failed to login for session test',
        details: loginError
      })
      console.log('❌ Failed: Could not login for session test')
    } else {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession()

      if (sessionData.session) {
        results.push({
          test: 'Session management',
          passed: true,
          message: 'Session created and retrieved successfully',
          details: {
            hasAccessToken: !!sessionData.session.access_token,
            hasRefreshToken: !!sessionData.session.refresh_token,
            userId: sessionData.session.user.id
          }
        })
        console.log('✅ Passed - Session created successfully')
        console.log(`   Has access token: ${!!sessionData.session.access_token}`)
        console.log(`   Has refresh token: ${!!sessionData.session.refresh_token}`)
      } else {
        results.push({
          test: 'Session management',
          passed: false,
          message: 'No session found after login'
        })
        console.log('❌ Failed: No session found after login')
      }

      // Sign out
      await supabase.auth.signOut()
    }
  } catch (error) {
    results.push({
      test: 'Session management',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    console.log('❌ Failed:', error)
  }

  return results
}

// Run tests and generate report
async function main() {
  console.log('Starting login system tests...\n')

  const results = await testLogin()

  console.log('\n\n=== Test Summary ===\n')

  const passed = results.filter(r => r.passed).length
  const total = results.length

  console.log(`Total tests: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${total - passed}`)
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`)

  console.log('\n=== Detailed Results ===\n')

  results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${index + 1}. ${result.test}: ${status}`)
    if (result.message) {
      console.log(`   ${result.message}`)
    }
  })

  console.log('\n=== Manual Testing Instructions ===\n')
  console.log('1. Open http://localhost:3000/login in your browser')
  console.log('2. Enter credentials:')
  console.log('   Email: test@abduloei.com')
  console.log('   Password: 123456')
  console.log('3. Click "เข้าสู่ระบบ"')
  console.log('4. You should be redirected to /dashboard')
  console.log('\nTest invalid credentials:')
  console.log('1. Try login with wrong password')
  console.log('2. Should see error message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"')
  console.log('\nTest validation:')
  console.log('1. Try empty email - should see "กรุณากรอกอีเมล"')
  console.log('2. Try invalid email format - should see "รูปแบบอีเมลไม่ถูกต้อง"')
  console.log('3. Try password less than 6 chars - should see "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"')

  if (passed === total) {
    console.log('\n✅ All tests passed! Login system is working correctly.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Please review the results above.')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
