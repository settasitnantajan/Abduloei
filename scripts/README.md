# Test Scripts

This directory contains utility scripts for testing and managing the Abduloei application.

## Available Scripts

### 1. Create Test User

Creates a test user in Supabase for development and testing purposes.

**File:** `create-test-user.ts`

**Command:**
```bash
npm run create-test-user
```

**What it does:**
- Creates a new user with email `test@abduloei.com` and password `123456`
- Uses Supabase Admin API (Service Role Key)
- Auto-confirms the email address
- Checks if user already exists before creating
- Displays user details after creation

**Output:**
```
=== Creating Test User ===

Email: test@abduloei.com
Password: 123456

✅ Test user created successfully!

=== User Details ===
User ID: 5f8dc80b-c2e7-4eae-b755-73d4f15e5461
Email: test@abduloei.com
Created at: 2026-03-09T04:54:37.610369Z
Email confirmed: Yes

=== Login Credentials ===
Email: test@abduloei.com
Password: 123456
```

**Use Case:**
- First-time setup
- Development testing
- Resetting test environment

---

### 2. Test Login System

Automated testing suite for the authentication system.

**File:** `test-login.ts`

**Command:**
```bash
npm run test-login
```

**What it does:**
- Runs comprehensive authentication tests
- Tests successful login flow
- Tests error handling (wrong password, invalid email, etc.)
- Validates session management
- Generates detailed test report

**Tests Included:**
1. Environment Variables Check
2. Login with Correct Credentials
3. Login with Incorrect Password (should fail)
4. Login with Non-existent Email (should fail)
5. Login with Empty Credentials (should fail)
6. Session Management Verification

**Output:**
```
=== Test Summary ===

Total tests: 6
Passed: 6
Failed: 0
Success rate: 100.0%

=== Detailed Results ===

1. Environment Variables: ✅ PASS
2. Login with correct credentials: ✅ PASS
3. Login with incorrect password: ✅ PASS
4. Login with non-existent email: ✅ PASS
5. Login with empty credentials: ✅ PASS
6. Session management: ✅ PASS
```

**Use Case:**
- Before deploying changes
- Regression testing
- CI/CD pipeline integration
- Verifying authentication flow

---

## Prerequisites

### Required Environment Variables

Make sure `.env.local` contains:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Required Dependencies

These are installed as dev dependencies:

- `tsx` - TypeScript execution
- `dotenv` - Environment variable loading
- `@supabase/supabase-js` - Supabase client

Install all dependencies:
```bash
npm install
```

---

## Usage Workflow

### First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create test user:**
   ```bash
   npm run create-test-user
   ```

3. **Verify with automated tests:**
   ```bash
   npm run test-login
   ```

4. **Manual testing:**
   - Start dev server: `npm run dev`
   - Open: http://localhost:3000/login
   - Login with: `test@abduloei.com` / `123456`

### Regular Development

```bash
# Run tests before committing
npm run test-login

# Recreate test user if needed
npm run create-test-user
```

---

## Script Details

### create-test-user.ts

**Technologies:**
- TypeScript
- Supabase Admin API
- dotenv for environment variables

**Key Features:**
- Idempotent (safe to run multiple times)
- Detailed error messages
- User existence checking
- Auto email confirmation

**Error Handling:**
- Checks for required environment variables
- Handles existing user gracefully
- Provides clear error messages

### test-login.ts

**Technologies:**
- TypeScript
- Supabase Client Library
- Automated testing patterns

**Test Coverage:**
- Positive test cases (valid login)
- Negative test cases (invalid credentials)
- Edge cases (empty fields, malformed email)
- Session management
- Token generation

**Output Format:**
- Colored console output (✅/❌)
- Detailed test results
- Summary statistics
- Manual testing instructions

---

## Troubleshooting

### "Missing environment variables" error

**Solution:** Check that `.env.local` exists and contains all required variables:
```bash
cat .env.local | grep SUPABASE
```

### "User already exists" message

**This is normal!** The script detects existing users. If you need to delete and recreate:
1. Go to Supabase Dashboard
2. Navigate to Authentication > Users
3. Delete the test user
4. Run `npm run create-test-user` again

### Tests failing

1. **Check Supabase connection:**
   ```bash
   curl https://faxauzhlgrfuhfvlybbg.supabase.co
   ```

2. **Verify credentials:**
   - Ensure test user exists in Supabase
   - Check email is confirmed

3. **Check environment:**
   ```bash
   node -e "require('dotenv').config({path: '.env.local'}); console.log(process.env.SUPABASE_URL)"
   ```

### TypeScript errors

Make sure all dependencies are installed:
```bash
npm install -D tsx @types/node @types/dotenv
```

---

## Adding New Scripts

To add a new test or utility script:

1. **Create script file:**
   ```bash
   touch scripts/my-new-script.ts
   ```

2. **Add to package.json:**
   ```json
   {
     "scripts": {
       "my-script": "tsx scripts/my-new-script.ts"
     }
   }
   ```

3. **Use environment variables:**
   ```typescript
   import * as dotenv from 'dotenv'
   import * as path from 'path'

   dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
   ```

4. **Run it:**
   ```bash
   npm run my-script
   ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Authentication
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm run create-test-user
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - run: npm run test-login
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

---

## Security Notes

### Service Role Key

- Only used in `create-test-user.ts`
- Never exposed to client
- Can bypass Row Level Security
- Should only be used in trusted environments

### Anon Key

- Used in `test-login.ts` and frontend
- Safe to expose to client
- Subject to Row Level Security policies
- Limited permissions

### Test Credentials

- Use only in development
- Never commit to version control
- Rotate credentials regularly
- Use different credentials for production

---

## Best Practices

1. **Run tests before commits:**
   ```bash
   npm run test-login && git commit
   ```

2. **Clean test data regularly:**
   - Delete old test users
   - Clear test sessions
   - Reset test state

3. **Keep scripts updated:**
   - Update when auth logic changes
   - Add tests for new features
   - Maintain documentation

4. **Monitor test results:**
   - Check test output carefully
   - Investigate any failures
   - Update tests as needed

---

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Zod Validation](https://zod.dev/)
- [TSX Documentation](https://github.com/esbuild-kit/tsx)

---

## Support

For issues or questions:
1. Check the test report: `TEST-REPORT.md`
2. Review Supabase logs
3. Check Next.js console output
4. Verify environment variables
