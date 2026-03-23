# Gemini API Models - Available Models

> บันทึกรายการ Models ที่ใช้ได้จาก Gemini API

**วันที่:** 9 มีนาคม 2026
**API Key:** AIzaSyCNPybz9k_sjmwQhEsesa3dsu1wIEGRQWc
**Status:** ✅ Verified

---

## 📊 สรุป

- **จำนวน Models ทั้งหมด:** 45 models
- **รองรับภาษาไทย:** ✅ ผ่านการทดสอบ
- **รองรับ generateContent:** ✅ ใช้งานได้

---

## 🎯 Models แนะนำสำหรับโปรเจกต์ Abduloei

### 1. **gemini-2.5-flash** (แนะนำอันดับ 1)
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
```

**ข้อมูล:**
- Display Name: Gemini 2.5 Flash
- Release: June 2025
- Max Tokens: 1 million
- Supported Methods: generateContent, countTokens, createCachedContent, batchGenerateContent

**เหมาะสำหรับ:**
- ✅ Chat ทั่วไป
- ✅ Command parsing (ภาษาไทย)
- ✅ Real-time response
- ✅ Cost-effective

**ทดสอบแล้ว:**
```
Input: "พรุ่งนี้ 2 โมงไปหาหมอ"
Output: {
  "action": "create_event",
  "title": "ไปหาหมอ",
  "date": "YYYY-MM-DD",
  "time": "14:00"
}
```

---

### 2. **gemini-2.5-pro** (สำหรับงานซับซ้อน)
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
```

**ข้อมูล:**
- Display Name: Gemini 2.5 Pro
- Release: June 17, 2025
- Supported Methods: generateContent, countTokens, createCachedContent, batchGenerateContent

**เหมาะสำหรับ:**
- ✅ Complex reasoning
- ✅ Multi-step tasks
- ✅ High accuracy requirements

---

### 3. **gemini-flash-latest** (Auto-update)
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
```

**ข้อมูล:**
- Display Name: Gemini Flash Latest
- อัปเดตเป็น version ล่าสุดอัตโนมัติ

**เหมาะสำหรับ:**
- ✅ Production (ได้ version ใหม่เสมอ)
- ✅ Long-term projects

---

## 📋 รายการ Models ทั้งหมด (45 models)

### Text Generation Models

| Model Name | Display Name | Release | Max Tokens | Methods |
|------------|--------------|---------|------------|---------|
| `gemini-2.5-flash` | Gemini 2.5 Flash | June 2025 | 1M | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.5-pro` | Gemini 2.5 Pro | June 17, 2025 | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.0-flash` | Gemini 2.0 Flash | - | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.0-flash-001` | Gemini 2.0 Flash 001 | Jan 2025 | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.0-flash-lite-001` | Gemini 2.0 Flash-Lite 001 | - | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.0-flash-lite` | Gemini 2.0 Flash-Lite | - | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-flash-latest` | Gemini Flash Latest | Auto | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-flash-lite-latest` | Gemini Flash-Lite Latest | Auto | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-pro-latest` | Gemini Pro Latest | Auto | - | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash-Lite | July 2025 | - | generateContent, countTokens, createCachedContent, batchGenerateContent |

### Preview/Experimental Models

| Model Name | Display Name | Type | Methods |
|------------|--------------|------|---------|
| `gemini-3-pro-preview` | Gemini 3 Pro Preview | Preview | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-3-flash-preview` | Gemini 3 Flash Preview | Preview | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | Preview | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-3.1-pro-preview-customtools` | Gemini 3.1 Pro Preview Custom Tools | Preview | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `gemini-3.1-flash-lite-preview` | Gemini 3.1 Flash Lite Preview | Preview | generateContent, countTokens, createCachedContent, batchGenerateContent |
| `deep-research-pro-preview-12-2025` | Deep Research Pro Preview | Preview | generateContent, countTokens |

### Text-to-Speech Models

| Model Name | Display Name | Methods |
|------------|--------------|---------|
| `gemini-2.5-flash-preview-tts` | Gemini 2.5 Flash Preview TTS | countTokens, generateContent |
| `gemini-2.5-pro-preview-tts` | Gemini 2.5 Pro Preview TTS | countTokens, generateContent, batchGenerateContent |

### Native Audio Models

| Model Name | Display Name | Methods |
|------------|--------------|---------|
| `gemini-2.5-flash-native-audio-latest` | Gemini 2.5 Flash Native Audio Latest | countTokens, bidiGenerateContent |
| `gemini-2.5-flash-native-audio-preview-09-2025` | Gemini 2.5 Flash Native Audio Preview 09-2025 | countTokens, bidiGenerateContent |
| `gemini-2.5-flash-native-audio-preview-12-2025` | Gemini 2.5 Flash Native Audio Preview 12-2025 | countTokens, bidiGenerateContent |

### Image Generation Models

| Model Name | Display Name | Methods |
|------------|--------------|---------|
| `gemini-2.0-flash-exp-image-generation` | Gemini 2.0 Flash (Image Generation) Experimental | generateContent, countTokens, bidiGenerateContent |
| `gemini-2.5-flash-image` | Nano Banana | generateContent, countTokens, batchGenerateContent |
| `gemini-3-pro-image-preview` | Nano Banana Pro | generateContent, countTokens, batchGenerateContent |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | generateContent, countTokens, batchGenerateContent |
| `imagen-4.0-generate-001` | Imagen 4 | predict |
| `imagen-4.0-ultra-generate-001` | Imagen 4 Ultra | predict |
| `imagen-4.0-fast-generate-001` | Imagen 4 Fast | predict |

### Video Generation Models

| Model Name | Display Name | Methods |
|------------|--------------|---------|
| `veo-2.0-generate-001` | Veo 2 | predictLongRunning |
| `veo-3.0-generate-001` | Veo 3 | predictLongRunning |
| `veo-3.0-fast-generate-001` | Veo 3 fast | predictLongRunning |
| `veo-3.1-generate-preview` | Veo 3.1 | predictLongRunning |
| `veo-3.1-fast-generate-preview` | Veo 3.1 fast | predictLongRunning |

### Small Models (Gemma)

| Model Name | Display Name | Methods |
|------------|--------------|---------|
| `gemma-3-1b-it` | Gemma 3 1B | generateContent, countTokens |
| `gemma-3-4b-it` | Gemma 3 4B | generateContent, countTokens |
| `gemma-3-12b-it` | Gemma 3 12B | generateContent, countTokens |
| `gemma-3-27b-it` | Gemma 3 27B | generateContent, countTokens |
| `gemma-3n-e4b-it` | Gemma 3n E4B | generateContent, countTokens |
| `gemma-3n-e2b-it` | Gemma 3n E2B | generateContent, countTokens |

### Specialized Models

| Model Name | Display Name | Type | Methods |
|------------|--------------|------|---------|
| `gemini-embedding-001` | Gemini Embedding 001 | Embeddings | embedContent, countTextTokens, countTokens, asyncBatchEmbedContent |
| `aqa` | AQA | Question Answering | generateAnswer |
| `gemini-robotics-er-1.5-preview` | Gemini Robotics-ER 1.5 Preview | Robotics | generateContent, countTokens |
| `gemini-2.5-computer-use-preview-10-2025` | Gemini 2.5 Computer Use Preview | Computer Use | generateContent, countTokens |

---

## ❌ Models ที่ Deprecated (ไม่ใช้งานได้)

| Model Name | Status | Reason |
|------------|--------|--------|
| `gemini-pro` | ❌ Not Found | Deprecated - ใช้ `gemini-2.5-flash` แทน |
| `gemini-1.5-pro` | ❌ Not Found | Deprecated - ใช้ `gemini-2.5-pro` แทน |
| `gemini-1.5-flash` | ❌ Not Found | Deprecated - ใช้ `gemini-2.5-flash` แทน |
| `gemini-1.0-pro` | ❌ Not Found | Deprecated - ใช้ `gemini-2.5-flash` แทน |
| `gemini-1.5-pro-latest` | ❌ Not Found | Deprecated - ใช้ `gemini-pro-latest` แทน |
| `gemini-1.5-flash-latest` | ❌ Not Found | Deprecated - ใช้ `gemini-flash-latest` แทน |
| `gemini-1.0-pro-latest` | ❌ Not Found | Deprecated - ใช้ `gemini-flash-latest` แทน |

---

## 🧪 ผลการทดสอบ

### ทดสอบภาษาไทย
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
const result = await model.generateContent('ตอบเป็นภาษาไทย: วันนี้เป็นวันอะไร?')

// Response: "วันนี้เป็นวัน[ชื่อวันปัจจุบัน] ครับ/ค่ะ"
```

**ผลลัพธ์:** ✅ รองรับภาษาไทยได้ดี

---

### ทดสอบ Command Parsing
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
const result = await model.generateContent(
  'แปลงคำสั่งนี้เป็น JSON: "พรุ่งนี้ 2 โมงไปหาหมอ" ' +
  'ให้เป็นรูปแบบ {action: "create_event", title: "...", date: "YYYY-MM-DD", time: "HH:mm"}'
)
```

**Response:**
```json
{
  "action": "create_event",
  "title": "ไปหาหมอ",
  "date": "YYYY-MM-DD",
  "time": "14:00"
}
```

**ผลลัพธ์:** ✅ เข้าใจภาษาไทยและแปลงเป็น JSON ได้ถูกต้อง

**หมายเหตุ:**
- "2 โมง" ถูกแปลงเป็น "14:00" (บ่าย 2 โมง) อัตโนมัติ
- "พรุ่งนี้" ต้องแปลงเป็นวันที่จริงด้วย code

---

## 💡 คำแนะนำการใช้งาน

### สำหรับโปรเจกต์ Abduloei

**ใช้ Model:**
```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
```

**System Prompt:**
```typescript
const today = new Date().toISOString().split('T')[0]

const systemPrompt = `
คุณคือ AI assistant ชื่อ Abduloei สำหรับจัดการบ้าน

งานของคุณคือแปลงคำสั่งภาษาไทยเป็น JSON

วันนี้คือ: ${today}

ตัวอย่าง:
Input: "พรุ่งนี้ 2 โมงไปหาหมอ"
Output: {
  "action": "create_event",
  "title": "ไปหาหมอ",
  "date": "2026-03-10",
  "time": "14:00"
}
`
```

**Usage:**
```typescript
const result = await model.generateContent([
  systemPrompt,
  userMessage
])
```

---

## 📚 เอกสารอ้างอิง

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Model List API](https://generativelanguage.googleapis.com/v1beta/models)
- [Pricing](https://ai.google.dev/pricing)

---

## 🔄 การอัปเดต

- **2026-03-09:** ทดสอบครั้งแรก - มี 45 models
- **แนะนำ:** เช็คอัปเดต models ใหม่ทุก 3-6 เดือน

---

**Last Updated:** 9 มีนาคม 2026
**Status:** ✅ Verified & Production Ready
