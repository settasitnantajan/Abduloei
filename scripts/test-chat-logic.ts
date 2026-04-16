import { detectConfirmation } from '../lib/ai/confirmation-detector';
import { parseCommand, isQueryCommand } from '../lib/ai/keyword-parser';
import { detectSearchNeed } from '../lib/ai/search-detector';
import { detectUserEmotion } from '../lib/ai/context-utils';

const tests = [
  { num: 1, msg: 'สวัสดีครับ', expect: 'สนทนาทั่วไป' },
  { num: 2, msg: 'นัดหมอฟันพรุ่งนี้บ่าย 2 โมง ต้องเตรียมบัตรประชาชนและบอกอิ่มว่าต้องเอาสมุดสุขภาพมาด้วย', expect: 'create_event + checklist + assignee' },
  { num: 3, msg: 'ใช่', expect: 'confirm' },
  { num: 4, msg: 'ไม่เอา', expect: 'reject' },
  { num: 5, msg: 'ต้องซื้อนมกับไข่ไก่', expect: 'create_task' },
  { num: 6, msg: 'จำไว้ว่ารหัส wifi บ้านคือ hello1234', expect: 'create_note' },
  { num: 7, msg: 'มีนัดอะไรบ้าง', expect: 'query' },
  { num: 8, msg: 'เครียดมากเลย งานเยอะไม่รู้จะจัดการยังไงดี', expect: 'emotion → ไม่ parse เป็น command' },
  { num: 9, msg: 'ราคาทองวันนี้เท่าไหร่', expect: 'web search → ไม่ parse เป็น command' },
  { num: 10, msg: 'ต้องซื้อของพรุ่งนี้เช้า 9 โมง', expect: 'create_event (มีวันเวลา)' },
];

console.log('=== ทดสอบ Chat Logic 10 Cases ===\n');

let passed = 0;
let failed = 0;

for (const t of tests) {
  const emotion = detectUserEmotion(t.msg);
  const search = detectSearchNeed(t.msg);
  const isEmotional = emotion.emotion !== 'neutral';
  const shouldSkip = search.needsSearch || isEmotional;
  const command = shouldSkip ? null : parseCommand(t.msg);
  const confirm = detectConfirmation(t.msg);
  const isQuery = isQueryCommand(t.msg);

  let result = '';
  let ok = false;

  if (t.num === 1) {
    // สนทนาทั่วไป — ไม่มี command, ไม่มี search, ไม่มี emotion
    ok = !command && !search.needsSearch && !isEmotional && confirm === 'none';
    result = ok ? 'ผ่าน — ไม่มีคำสั่ง → ส่งไป AI' : `ไม่ผ่าน — command=${command?.type}, search=${search.needsSearch}, emotion=${emotion.emotion}`;
  } else if (t.num === 2) {
    ok = command?.type === 'create_event' && (command?.checklist_items?.length ?? 0) > 0;
    result = ok ? `ผ่าน — event "${command!.title}" + ${command!.checklist_items!.length} checklist` : `ไม่ผ่าน — ${command?.type || 'null'}, checklist=${command?.checklist_items?.length ?? 0}`;
  } else if (t.num === 3) {
    ok = confirm === 'confirm';
    result = ok ? 'ผ่าน — confirm' : `ไม่ผ่าน — ${confirm}`;
  } else if (t.num === 4) {
    ok = confirm === 'reject';
    result = ok ? 'ผ่าน — reject' : `ไม่ผ่าน — ${confirm}`;
  } else if (t.num === 5) {
    ok = command?.type === 'create_task';
    result = ok ? `ผ่าน — task "${command!.title}"` : `ไม่ผ่าน — ${command?.type || 'null'}`;
  } else if (t.num === 6) {
    ok = command?.type === 'create_note';
    result = ok ? `ผ่าน — note "${command!.title}"` : `ไม่ผ่าน — ${command?.type || 'null'}`;
  } else if (t.num === 7) {
    ok = isQuery;
    result = ok ? 'ผ่าน — query detected' : `ไม่ผ่าน — isQuery=${isQuery}`;
  } else if (t.num === 8) {
    ok = isEmotional && !command;
    result = ok ? `ผ่าน — emotion="${emotion.emotion}" → ไม่ parse command` : `ไม่ผ่าน — emotion=${emotion.emotion}, command=${command?.type || 'null'}`;
  } else if (t.num === 9) {
    ok = search.needsSearch && !command;
    result = ok ? `ผ่าน — search (${search.reason}) → ไม่ parse command` : `ไม่ผ่าน — search=${search.needsSearch}, command=${command?.type || 'null'}`;
  } else if (t.num === 10) {
    ok = command?.type === 'create_event';
    result = ok ? `ผ่าน — event "${command!.title}" (มีวันเวลา → event)` : `ไม่ผ่าน — ${command?.type || 'null'}`;
  }

  if (ok) passed++; else failed++;

  const icon = ok ? '✅' : '❌';
  console.log(`#${t.num} ${icon} "${t.msg}"`);
  console.log(`   คาด: ${t.expect}`);
  console.log(`   ผล:  ${result}`);
  console.log('');
}

console.log(`=== สรุป: ผ่าน ${passed}/10, ไม่ผ่าน ${failed}/10 ===`);
