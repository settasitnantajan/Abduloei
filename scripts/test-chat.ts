import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { generateAIResponse } from '../lib/ai/gemini';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function testChat() {
  console.log('🤖 Testing Chat System\n');

  const testMessages = [
    'สวัสดีครับ',
    'วันนี้อากาศเป็นยังไง?',
    'ช่วยแนะนำเมนูอาหารเย็นหน่อย',
    'ขอบคุณครับ',
  ];

  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const message of testMessages) {
    console.log('👤 User:', message);

    try {
      const response = await generateAIResponse(message, conversationHistory);
      console.log('🤖 AI:', response);
      console.log('---\n');

      // Add to history
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: response });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('❌ Error:', error);
      break;
    }
  }

  console.log('✅ Test completed!');
}

testChat();
