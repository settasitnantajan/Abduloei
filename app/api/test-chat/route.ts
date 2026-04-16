import { NextResponse } from 'next/server';
import { detectConfirmation } from '@/lib/ai/confirmation-detector';
import { parseCommand, isQueryCommand } from '@/lib/ai/keyword-parser';
import { detectSearchNeed } from '@/lib/ai/search-detector';
import { detectUserEmotion } from '@/lib/ai/context-utils';

export async function GET() {
  const tests = [
    { num: 1, msg: 'สวัสดีครับ', expect: 'สนทนาทั่วไป' },
    { num: 2, msg: 'นัดหมอฟันพรุ่งนี้บ่าย 2 โมง ต้องเตรียมบัตรประชาชนและบอกอิ่มว่าต้องเอาสมุดสุขภาพมาด้วย', expect: 'create_event + checklist' },
    { num: 3, msg: 'ใช่', expect: 'confirm' },
    { num: 4, msg: 'ไม่เอา', expect: 'reject' },
    { num: 5, msg: 'ต้องซื้อนมกับไข่ไก่', expect: 'create_task' },
    { num: 6, msg: 'จำไว้ว่ารหัส wifi บ้านคือ hello1234', expect: 'create_note' },
    { num: 7, msg: 'มีนัดอะไรบ้าง', expect: 'query' },
    { num: 8, msg: 'เครียดมากเลย งานเยอะไม่รู้จะจัดการยังไงดี', expect: 'emotion → ไม่ parse' },
    { num: 9, msg: 'ราคาทองวันนี้เท่าไหร่', expect: 'search → ไม่ parse' },
    { num: 10, msg: 'ต้องซื้อของพรุ่งนี้เช้า 9 โมง', expect: 'create_event' },
  ];

  const results = tests.map(t => {
    const emotion = detectUserEmotion(t.msg);
    const search = detectSearchNeed(t.msg);
    const isEmotional = emotion.emotion !== 'neutral';
    const shouldSkip = search.needsSearch || isEmotional;
    const command = shouldSkip ? null : parseCommand(t.msg);
    const confirm = detectConfirmation(t.msg);
    const isQuery = isQueryCommand(t.msg);

    let ok = false;
    let result = '';

    switch (t.num) {
      case 1: ok = !command && !search.needsSearch && !isEmotional && confirm === 'none'; break;
      case 2: ok = command?.type === 'create_event' && (command?.checklist_items?.length ?? 0) > 0; break;
      case 3: ok = confirm === 'confirm'; break;
      case 4: ok = confirm === 'reject'; break;
      case 5: ok = command?.type === 'create_task'; break;
      case 6: ok = command?.type === 'create_note'; break;
      case 7: ok = isQuery; break;
      case 8: ok = isEmotional && !command; break;
      case 9: ok = search.needsSearch && !command; break;
      case 10: ok = command?.type === 'create_event'; break;
    }

    return {
      num: t.num,
      msg: t.msg,
      expect: t.expect,
      ok,
      emotion: emotion.emotion,
      search: search.needsSearch ? search.reason : null,
      command: command ? { type: command.type, title: command.title, checklist: command.checklist_items?.length ?? 0 } : null,
      confirm,
      isQuery,
    };
  });

  const passed = results.filter(r => r.ok).length;

  return NextResponse.json({ passed, total: 10, results });
}
