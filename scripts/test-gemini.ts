import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API...\n')

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env.local')
    process.exit(1)
  }

  console.log('✅ API Key found:', apiKey.substring(0, 20) + '...\n')

  try {
    const genAI = new GoogleGenerativeAI(apiKey)

    // List all available models
    console.log('📋 Listing all available models from API:\n')

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      )
      const data = await response.json()

      if (data.models && data.models.length > 0) {
        console.log(`Found ${data.models.length} models:\n`)

        data.models.forEach((model: any) => {
          console.log(`  • ${model.name}`)
          console.log(`    Display Name: ${model.displayName}`)
          console.log(`    Description: ${model.description}`)
          console.log(`    Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`)
          console.log()
        })
      } else {
        console.log('❌ No models available for this API key')
        if (data.error) {
          console.log(`   Error: ${data.error.message}`)
        }
      }
    } catch (error: any) {
      console.log('❌ Failed to list models')
      console.log(`   Error: ${error.message}`)
    }

    console.log('\n📋 Testing Common Models:\n')

    const models = [
      'gemini-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'gemini-1.0-pro-latest',
      'models/gemini-pro',
      'models/gemini-1.5-pro-latest',
    ]

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent('Say "OK" if you can hear me')
        const response = result.response.text()

        console.log(`✅ ${modelName}`)
        console.log(`   Response: ${response}`)
        console.log()
      } catch (error: any) {
        console.log(`❌ ${modelName}`)
        console.log(`   Error: ${error.message.split('\n')[0]}`)
        console.log()
      }
    }

    // Test Thai language with working model
    console.log('\n🇹🇭 Testing Thai Language Support:\n')

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent(
        'ตอบเป็นภาษาไทย: วันนี้เป็นวันอะไร?'
      )
      const response = result.response.text()

      console.log('✅ Thai language supported (gemini-2.5-flash)')
      console.log(`   Response: ${response}`)
      console.log()
    } catch (error: any) {
      console.log('❌ Thai language test failed')
      console.log(`   Error: ${error.message}`)
      console.log()
    }

    // Test command parsing
    console.log('🤖 Testing Command Parsing (Thai):\n')

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const result = await model.generateContent(
        'แปลงคำสั่งนี้เป็น JSON: "พรุ่งนี้ 2 โมงไปหาหมอ" ให้เป็นรูปแบบ {action: "create_event", title: "...", date: "YYYY-MM-DD", time: "HH:mm"}'
      )
      const response = result.response.text()

      console.log('✅ Command parsing works!')
      console.log(`   Response: ${response}`)
      console.log()
    } catch (error: any) {
      console.log('❌ Command parsing failed')
      console.log(`   Error: ${error.message}`)
      console.log()
    }

    console.log('\n✨ Test completed!')

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

testGeminiAPI()
