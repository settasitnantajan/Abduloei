'use client';

import {
  Package,
  UtensilsCrossed,
  Shirt,
  ShoppingCart,
  CreditCard,
  Car,
  Coffee,
  Fuel,
  Plane,
  Clapperboard,
  House,
  Pill,
  Lightbulb,
  Droplet,
  Smartphone,
  BookOpen,
  NotebookPen,
  Calendar,
  PartyPopper,
  Moon,
  Sunrise,
  Circle,
} from 'lucide-react';

/**
 * แปลงไอคอนที่เก็บเป็น emoji ใน database ให้เป็นไอคอนเส้น
 *
 * ข้อมูลเก่าถูกบันทึกเป็น emoji ไว้แล้ว จึงแปลงตอนแสดงผลแทนการแก้ข้อมูลย้อนหลัง
 * emoji ที่ไม่รู้จักให้ใช้จุดกลมแทน เพื่อไม่ให้มี emoji หลุดออกมาบนหน้าจอ
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  '📦': Package,
  '🍜': UtensilsCrossed,
  '🍽': UtensilsCrossed,
  '🍽️': UtensilsCrossed,
  '👕': Shirt,
  '🛒': ShoppingCart,
  '💳': CreditCard,
  '🚕': Car,
  '☕': Coffee,
  '⛽': Fuel,
  '✈': Plane,
  '✈️': Plane,
  '🎬': Clapperboard,
  '🏠': House,
  '💊': Pill,
  '💡': Lightbulb,
  '💧': Droplet,
  '📱': Smartphone,
  '📚': BookOpen,
  '📝': NotebookPen,
  '📅': Calendar,
  '🎉': PartyPopper,
  '🌙': Moon,
  '🌅': Sunrise,
};

/**
 * หมวดที่ให้เลือกในฟอร์ม — เก็บค่าเป็น emoji เดิมเพื่อให้เข้ากับข้อมูลที่มีอยู่
 *
 * ผู้ใช้กดเลือกจากกริด ไม่ต้องพิมพ์ emoji เอง ซึ่งบนมือถือต้องสลับคีย์บอร์ด
 * และพิมพ์ตัวที่ไม่อยู่ใน ICON_MAP จะกลายเป็นจุดกลมโดยไม่มีอะไรบอก
 */
export const ICON_CHOICES: Array<{ value: string; label: string }> = [
  { value: '🛒', label: 'ซูเปอร์' },
  { value: '🍜', label: 'อาหาร' },
  { value: '☕', label: 'กาแฟ' },
  { value: '🚕', label: 'เดินทาง' },
  { value: '⛽', label: 'น้ำมัน' },
  { value: '📦', label: 'ของออนไลน์' },
  { value: '👕', label: 'เสื้อผ้า' },
  { value: '💊', label: 'ยา/สุขภาพ' },
  { value: '🎬', label: 'บันเทิง' },
  { value: '📱', label: 'มือถือ/เน็ต' },
  { value: '💡', label: 'ค่าไฟ' },
  { value: '💧', label: 'ค่าน้ำ' },
  { value: '🏠', label: 'บ้าน' },
  { value: '✈️', label: 'ท่องเที่ยว' },
  { value: '📚', label: 'เรียน' },
  { value: '💳', label: 'อื่นๆ' },
];

export default function CategoryIcon({
  icon,
  className = 'w-4 h-4',
}: {
  /** ค่า icon ที่เก็บไว้ใน database — เป็น emoji หรือ null */
  icon?: string | null;
  className?: string;
}) {
  const Found = icon ? ICON_MAP[icon.trim()] : undefined;
  const Icon = Found ?? Circle;

  return <Icon className={`${className} text-gray-500 shrink-0`} />;
}

/** เลือกหมวดจากกริด แทนการพิมพ์ emoji เอง */
export function IconPicker({
  name = 'icon',
  defaultValue,
  label = 'หมวด',
}: {
  name?: string;
  defaultValue?: string | null;
  label?: string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-gray-300">{label}</legend>
      <div className="grid grid-cols-8 gap-1.5">
        {ICON_CHOICES.map(choice => {
          const Icon = ICON_MAP[choice.value] ?? Circle;
          return (
            <label
              key={choice.value}
              title={choice.label}
              className="flex items-center justify-center h-11 rounded-lg border border-[#333338] bg-[#111111] text-gray-400 cursor-pointer hover:border-[#00B900]/50 has-checked:border-[#00B900]/60 has-checked:bg-[#00B900]/10 has-checked:text-[#00B900] transition-colors"
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                defaultChecked={defaultValue === choice.value}
                aria-label={choice.label}
                className="sr-only"
              />
              <Icon className="w-4 h-4" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
