import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SearchResult {
  content: string;
  sources: string[];
}

/**
 * ค้นหาข้อมูลจากอินเทอร์เน็ตโดยใช้ Gemini with Google Search grounding
 */
export async function searchWeb(query: string): Promise<SearchResult> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ใช้ Gemini 2.5 Flash พร้อม Google Search tool
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as any],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    });

    const searchPrompt = `ค้นหาข้อมูลล่าสุดเกี่ยวกับ: ${query}

ตอบเป็นภาษาไทยที่เข้าใจง่าย สั้น กระชับ พร้อมตัวเลขที่ชัดเจน`;

    const result = await model.generateContent(searchPrompt);
    const response = result.response;
    const text = response.text();

    // ดึง grounding sources จาก response metadata
    const sources: string[] = [];
    const candidates = response.candidates;
    if (candidates && candidates[0]) {
      const groundingMetadata = (candidates[0] as any).groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push(chunk.web.title || chunk.web.uri);
          }
        }
      }
    }

    // Fallback: ดึง URL จากเนื้อหา
    if (sources.length === 0) {
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const matches = text.match(urlPattern);
      if (matches) {
        sources.push(...matches.slice(0, 3));
      }
    }

    return {
      content: text,
      sources: sources.slice(0, 3),
    };
  } catch (error) {
    console.error('Web search error:', error);

    // Fallback: ถ้า Google Search tool ไม่พร้อม ให้คืนค่าว่าง (จะไปใช้ AI ปกติแทน)
    return {
      content: '',
      sources: [],
    };
  }
}

/**
 * Format search results for display in chat
 */
export function formatSearchResults(result: SearchResult): string {
  // ถ้าไม่มีเนื้อหา คืนค่าว่าง (จะ fallback ไปใช้ AI ปกติ)
  if (!result.content || result.content.trim().length === 0) {
    return '';
  }

  let output = result.content;

  if (result.sources.length > 0) {
    output += '\n\n📚 แหล่งอ้างอิง:\n';
    result.sources.forEach((source, index) => {
      output += `${index + 1}. ${source}\n`;
    });
  }

  return output;
}
