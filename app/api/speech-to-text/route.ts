import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/ai/speech-to-text';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'ไม่พบไฟล์เสียง' },
        { status: 400 }
      );
    }

    // จำกัดขนาดไฟล์ 10MB
    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ไฟล์เสียงใหญ่เกินไป (สูงสุด 10MB)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || 'audio/webm';

    const text = await transcribeAudio(buffer, mimeType);

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถแปลงเสียงเป็นข้อความได้ กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}
