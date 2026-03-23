# UI Pages Documentation

## Overview

Abduloei has a Messenger-style interface with 3 main pages designed for simplicity and ease of use. The interface is optimized for Thai language and supports both text and voice input.

## Design Principles

- **Messenger-style UI**: Inspired by Facebook Messenger for familiarity
- **Mobile-first**: Responsive design that works on all devices
- **Thai language**: All UI text in Thai, support for Thai date formats (Buddhist Era)
- **Simple & Clean**: Minimal complexity, focused on essential features
- **Voice-first**: Prominent voice input button for hands-free interaction

## Color Palette

```css
:root {
  --primary: #0084FF;        /* Messenger blue */
  --primary-dark: #0066CC;
  --primary-light: #E7F3FF;

  --secondary: #E4E6EB;      /* Light gray */
  --background: #F0F2F5;     /* Page background */
  --surface: #FFFFFF;        /* Cards, panels */

  --text-primary: #050505;
  --text-secondary: #65676B;
  --text-tertiary: #8A8D91;

  --success: #00A400;
  --error: #FA383E;
  --warning: #F7B500;

  --border: #CED0D4;
  --shadow: rgba(0, 0, 0, 0.1);
}
```

## Typography

- **Font Family**: Noto Sans Thai, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
- **Font Sizes**:
  - Heading 1: 24px (1.5rem)
  - Heading 2: 20px (1.25rem)
  - Body: 15px (0.9375rem)
  - Small: 13px (0.8125rem)

## Common Components

### Navigation Bar

Fixed top navigation present on all pages:

```tsx
// components/NavBar.tsx
export default function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-50">
      <div className="max-w-5xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo/Home */}
        <Link href="/" className="flex items-center gap-2">
          <HomeIcon className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">Abduloei</span>
        </Link>

        {/* Home Selector */}
        <HomeSelector />

        {/* User Menu */}
        <UserMenu />
      </div>
    </nav>
  );
}
```

### Home Selector

Dropdown to switch between homes:

```tsx
// components/HomeSelector.tsx
export default function HomeSelector() {
  const [homes, setHomes] = useState<Home[]>([]);
  const [currentHome, setCurrentHome] = useState<Home | null>(null);

  return (
    <Dropdown>
      <DropdownTrigger>
        <button className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-border">
          <span className="text-sm font-medium">{currentHome?.name || 'เลือกบ้าน'}</span>
          <ChevronDownIcon className="w-4 h-4 ml-1" />
        </button>
      </DropdownTrigger>
      <DropdownContent>
        {homes.map(home => (
          <DropdownItem key={home.id} onClick={() => setCurrentHome(home)}>
            <HomeIcon className="w-4 h-4" />
            <span>{home.name}</span>
            {home.role === 'owner' && <CrownIcon className="w-3 h-3 text-warning" />}
          </DropdownItem>
        ))}
        <DropdownDivider />
        <DropdownItem href="/homes/create">
          <PlusIcon className="w-4 h-4" />
          <span>สร้างบ้านใหม่</span>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
```

### Bottom Tab Bar (Mobile)

Mobile navigation at bottom:

```tsx
// components/BottomTabBar.tsx
export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-50">
      <div className="flex h-full">
        <TabButton href="/" icon={<GridIcon />} label="หน้าหลัก" active={pathname === '/'} />
        <TabButton href="/chat" icon={<ChatIcon />} label="แชท" active={pathname === '/chat'} />
        <TabButton href="/settings" icon={<SettingsIcon />} label="ตั้งค่า" active={pathname === '/settings'} />
      </div>
    </div>
  );
}
```

## Page 1: Dashboard (หน้าหลัก)

### Layout

```
┌─────────────────────────────────────┐
│ ☰  Abduloei    [บ้าน ▾]    [👤]   │ ← NavBar
├─────────────────────────────────────┤
│                                     │
│  📅 วันที่ 8 มีนาคม 2569           │ ← Date Header
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📌 กิจกรรมวันนี้              │ │ ← Today's Events
│  │                               │ │
│  │ 🕐 10:00 - ประชุมทีม          │ │
│  │ 🕐 15:30 - รับลูกเลิกเรียน    │ │
│  │                               │ │
│  │ [+ เพิ่มกิจกรรม]             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ✅ งานที่ต้องทำ               │ │ ← Tasks
│  │                               │ │
│  │ ☐ ซื้อของที่ตลาด             │ │
│  │ ☐ ชำระค่าไฟ                  │ │
│  │                               │ │
│  │ [+ เพิ่มงาน]                 │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📝 บันทึกย่อ                  │ │ ← Quick Notes
│  │                               │ │
│  │ • ร้านข้าวมันไก่เลขที่ 123   │ │
│  │ • รหัส Wi-Fi: abc123         │ │
│  │                               │ │
│  │ [+ เพิ่มบันทึก]               │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
│  [หน้าหลัก] [แชท] [ตั้งค่า]      │ ← Mobile Tabs
└─────────────────────────────────────┘
```

### Components

#### Date Header

```tsx
// components/dashboard/DateHeader.tsx
export default function DateHeader() {
  const [date, setDate] = useState(new Date());

  // Format in Thai Buddhist Era
  const thaiDate = date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="py-6 px-4 bg-gradient-to-r from-primary to-primary-dark">
      <div className="max-w-5xl mx-auto">
        <p className="text-sm text-white/80">วันนี้</p>
        <h1 className="text-2xl font-bold text-white mt-1">{thaiDate}</h1>
      </div>
    </div>
  );
}
```

#### Events Section

```tsx
// components/dashboard/EventsSection.tsx
export default function EventsSection({ homeId }: { homeId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadTodayEvents();
  }, [homeId]);

  return (
    <section className="bg-surface rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          กิจกรรมวันนี้
        </h2>
        <Link href="/chat?action=create_event" className="text-primary text-sm">
          + เพิ่ม
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-text-secondary text-sm text-center py-6">
          ไม่มีกิจกรรมวันนี้
        </p>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
```

#### Event Card

```tsx
// components/dashboard/EventCard.tsx
export default function EventCard({ event }: { event: Event }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center">
        <ClockIcon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary">{event.title}</p>
        <p className="text-sm text-text-secondary mt-0.5">
          {event.time} {event.description && `• ${event.description}`}
        </p>
        {event.for_member && (
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-secondary rounded text-xs text-text-secondary">
            <UserIcon className="w-3 h-3" />
            {event.for_member}
          </span>
        )}
      </div>
      <button className="text-text-tertiary hover:text-text-primary">
        <MoreIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
```

#### Tasks Section

```tsx
// components/dashboard/TasksSection.tsx
export default function TasksSection({ homeId }: { homeId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const toggleTask = async (taskId: string, completed: boolean) => {
    // Update task status
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ status: completed ? 'completed' : 'pending' })
      .eq('id', taskId);

    // Refresh list
    loadTasks();
  };

  return (
    <section className="bg-surface rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-primary" />
          งานที่ต้องทำ
        </h2>
        <Link href="/chat?action=create_task" className="text-primary text-sm">
          + เพิ่ม
        </Link>
      </div>

      {tasks.length === 0 ? (
        <p className="text-text-secondary text-sm text-center py-6">
          ไม่มีงานค้างอยู่
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={toggleTask} />
          ))}
        </div>
      )}
    </section>
  );
}
```

#### Task Item

```tsx
// components/dashboard/TaskItem.tsx
export default function TaskItem({
  task,
  onToggle
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
      <button
        onClick={() => onToggle(task.id, task.status !== 'completed')}
        className="flex-shrink-0"
      >
        {task.status === 'completed' ? (
          <CheckCircleIconSolid className="w-6 h-6 text-success" />
        ) : (
          <CircleIcon className="w-6 h-6 text-text-tertiary" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          task.status === 'completed' ? "line-through text-text-secondary" : "text-text-primary"
        )}>
          {task.title}
        </p>
        {task.due_date && (
          <p className="text-xs text-text-tertiary mt-0.5">
            ครบกำหนด: {formatThaiDate(task.due_date)}
          </p>
        )}
      </div>
    </div>
  );
}
```

#### Notes Section

```tsx
// components/dashboard/NotesSection.tsx
export default function NotesSection({ homeId }: { homeId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);

  return (
    <section className="bg-surface rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <DocumentIcon className="w-5 h-5 text-primary" />
          บันทึกย่อ
        </h2>
        <Link href="/chat?action=create_note" className="text-primary text-sm">
          + เพิ่ม
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-text-secondary text-sm text-center py-6">
          ยังไม่มีบันทึก
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </section>
  );
}
```

## Page 2: Chat/Voice Interface (หน้าแชท)

### Layout

```
┌─────────────────────────────────────┐
│ ☰  Abduloei    [บ้าน ▾]    [👤]   │ ← NavBar
├─────────────────────────────────────┤
│                                     │
│                                     │
│  [แชท 1]                           │ ← Chat History
│  สร้างกิจกรรม "ประชุม" พรุ่งนี้   │   (Scrollable)
│  10:00 น.                          │
│                                     │
│  [แชท 2]                           │
│  ✅ สร้างกิจกรรมเรียบร้อย         │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [🎤]  พิมพ์ข้อความ...        [⏎] │ ← Input Area
└─────────────────────────────────────┘
```

### Components

#### Chat Container

```tsx
// app/chat/page.tsx
export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Process with AI
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      // Add AI response
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: data.response,
        action: data.action,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      // Add error message
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen pt-14 pb-16 md:pb-0">
      {/* Chat Messages */}
      <ChatMessages messages={messages} />

      {/* Input Area */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isListening={isListening}
        onVoiceToggle={() => toggleVoiceInput()}
        isProcessing={isProcessing}
      />
    </div>
  );
}
```

#### Chat Messages

```tsx
// components/chat/ChatMessages.tsx
export default function ChatMessages({ messages }: { messages: ChatMessage[] }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-background">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
```

#### Empty State

```tsx
// components/chat/EmptyState.tsx
export default function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-light flex items-center justify-center">
        <SparklesIcon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold mb-2">สวัสดี! 👋</h3>
      <p className="text-text-secondary text-sm mb-6">
        ฉันพร้อมช่วยคุณจัดการกิจกรรม งาน และบันทึกต่างๆ
      </p>

      <div className="space-y-2 text-left max-w-md mx-auto">
        <p className="text-xs text-text-tertiary mb-2">ตัวอย่างคำสั่ง:</p>
        <ExampleCommand text="สร้างกิจกรรมประชุมทีมพรุ่งนี้ 10:00 น." />
        <ExampleCommand text="เพิ่มงานซื้อของที่ตลาด" />
        <ExampleCommand text="บันทึกว่า รหัส Wi-Fi คือ abc123" />
        <ExampleCommand text="มีกิจกรรมอะไรบ้างวันนี้" />
      </div>
    </div>
  );
}
```

#### Message Bubble

```tsx
// components/chat/MessageBubble.tsx
export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.type === 'user';

  return (
    <div className={cn(
      "flex gap-2",
      isUser ? "justify-end" : "justify-start"
    )}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <BotIcon className="w-5 h-5 text-white" />
        </div>
      )}

      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-2.5",
        isUser
          ? "bg-primary text-white rounded-br-md"
          : "bg-surface text-text-primary rounded-bl-md shadow-sm"
      )}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {message.action && (
          <ActionResult action={message.action} />
        )}

        <p className={cn(
          "text-xs mt-1.5",
          isUser ? "text-white/70" : "text-text-tertiary"
        )}>
          {formatTime(message.timestamp)}
        </p>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-text-secondary" />
        </div>
      )}
    </div>
  );
}
```

#### Action Result

Shows confirmation when AI completes an action:

```tsx
// components/chat/ActionResult.tsx
export default function ActionResult({ action }: { action: AIAction }) {
  if (action.action === 'create_event') {
    return (
      <div className="mt-3 p-3 bg-success/10 rounded-lg border border-success/20">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-success">สร้างกิจกรรมเรียบร้อย</span>
        </div>
        <div className="text-sm space-y-1">
          <p>📅 {action.title}</p>
          {action.date && <p>🗓️ {formatThaiDate(action.date)}</p>}
          {action.time && <p>🕐 {action.time}</p>}
        </div>
        <Link
          href="/"
          className="inline-block mt-2 text-xs text-primary hover:underline"
        >
          ดูในหน้าหลัก →
        </Link>
      </div>
    );
  }

  // Similar for create_task, create_note, etc.
}
```

#### Chat Input

```tsx
// components/chat/ChatInput.tsx
export default function ChatInput({
  value,
  onChange,
  onSend,
  isListening,
  onVoiceToggle,
  isProcessing,
}: ChatInputProps) {
  return (
    <div className="border-t border-border bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Voice Button */}
          <button
            onClick={onVoiceToggle}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isListening
                ? "bg-error text-white animate-pulse"
                : "bg-primary text-white hover:bg-primary-dark"
            )}
          >
            {isListening ? (
              <MicrophoneOffIcon className="w-5 h-5" />
            ) : (
              <MicrophoneIcon className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={isListening ? "กำลังฟัง..." : "พิมพ์ข้อความ..."}
              disabled={isListening || isProcessing}
              className="w-full px-4 py-2.5 bg-secondary rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || isProcessing}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              value.trim() && !isProcessing
                ? "bg-primary text-white hover:bg-primary-dark"
                : "bg-secondary text-text-tertiary cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <LoadingSpinner className="w-5 h-5" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {isListening && (
          <p className="text-xs text-text-secondary mt-2 text-center">
            🎤 กด Esc เพื่อยกเลิก
          </p>
        )}
      </div>
    </div>
  );
}
```

#### Voice Input Hook

```tsx
// hooks/useVoiceInput.ts
export function useVoiceInput(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onResult]);

  const toggle = () => {
    if (!recognitionRef.current) {
      alert('เบราว์เซอร์นี้ไม่รองรับการรับรู้เสียง');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return { isListening, toggle };
}
```

## Page 3: Settings (ตั้งค่า)

### Layout

```
┌─────────────────────────────────────┐
│ ☰  Abduloei    [บ้าน ▾]    [👤]   │ ← NavBar
├─────────────────────────────────────┤
│                                     │
│  ตั้งค่า                            │ ← Page Title
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 👤 โปรไฟล์                    │ │ ← Profile Section
│  │ ชื่อ: สมชาย ใจดี              │ │
│  │ อีเมล: somchai@email.com     │ │
│  │                               │ │
│  │ [แก้ไขโปรไฟล์]               │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🏠 จัดการบ้าน                 │ │ ← Homes Section
│  │                               │ │
│  │ บ้านของฉัน (เจ้าของ)         │ │
│  │ • สมาชิก 2 คน                │ │
│  │ [จัดการ] [ออก]               │ │
│  │                               │ │
│  │ [+ สร้างบ้านใหม่]             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🔔 การแจ้งเตือน LINE          │ │ ← LINE Settings
│  │                               │ │
│  │ ○ ยังไม่ได้เชื่อมต่อ         │ │
│  │ [เชื่อมต่อ LINE]              │ │
│  │                               │ │
│  │ หรือ                          │ │
│  │                               │ │
│  │ ● เชื่อมต่อแล้ว               │ │
│  │ □ สรุปรายวัน เวลา [08:00]    │ │
│  │ □ เตือนกิจกรรม [5] นาทีก่อน  │ │
│  │ [ตัดการเชื่อมต่อ]             │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🚪 ออกจากระบบ                 │ │ ← Logout
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### Components

#### Settings Container

```tsx
// app/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="min-h-screen pt-14 pb-20 md:pb-8 bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">ตั้งค่า</h1>

        <div className="space-y-4">
          <ProfileSection />
          <HomesSection />
          <LineNotificationSection />
          <LogoutSection />
        </div>
      </div>
    </div>
  );
}
```

#### Profile Section

```tsx
// components/settings/ProfileSection.tsx
export default function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  return (
    <section className="bg-surface rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <UserIcon className="w-5 h-5 text-primary" />
        โปรไฟล์
      </h2>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-text-secondary">ชื่อ</label>
          <p className="font-medium">{profile?.name || '-'}</p>
        </div>
        <div>
          <label className="text-sm text-text-secondary">อีเมล</label>
          <p className="font-medium">{profile?.email}</p>
        </div>
      </div>

      <button className="mt-4 px-4 py-2 bg-secondary hover:bg-border rounded-lg text-sm font-medium transition-colors">
        แก้ไขโปรไฟล์
      </button>
    </section>
  );
}
```

#### Homes Section

```tsx
// components/settings/HomesSection.tsx
export default function HomesSection() {
  const [homes, setHomes] = useState<HomeWithRole[]>([]);

  return (
    <section className="bg-surface rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <HomeIcon className="w-5 h-5 text-primary" />
        จัดการบ้าน
      </h2>

      <div className="space-y-3">
        {homes.map(home => (
          <div key={home.id} className="p-3 rounded-lg border border-border">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{home.name}</p>
                <p className="text-sm text-text-secondary mt-0.5">
                  {getRoleText(home.role)} • สมาชิก {home.member_count} คน
                </p>
              </div>
              {home.role === 'owner' && (
                <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded">
                  เจ้าของ
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <Link
                href={`/homes/${home.id}`}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark"
              >
                จัดการ
              </Link>
              {home.role !== 'owner' && (
                <button
                  onClick={() => leaveHome(home.id)}
                  className="px-3 py-1.5 bg-secondary text-text-primary rounded-lg text-sm hover:bg-border"
                >
                  ออกจากบ้าน
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/homes/create"
        className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary hover:bg-border rounded-lg text-sm font-medium transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        สร้างบ้านใหม่
      </Link>
    </section>
  );
}
```

#### LINE Notification Section

```tsx
// components/settings/LineNotificationSection.tsx
export default function LineNotificationSection() {
  const [connection, setConnection] = useState<LineConnection | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const connectLine = () => {
    window.location.href = '/api/line/connect';
  };

  const disconnectLine = async () => {
    if (!confirm('คุณต้องการตัดการเชื่อมต่อ LINE ใช่หรือไม่?')) return;

    const supabase = createClient();
    await supabase
      .from('line_connections')
      .update({ is_active: false })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    setConnection(null);
  };

  const updateSettings = async (key: string, value: any) => {
    const supabase = createClient();
    await supabase
      .from('notification_settings')
      .update({ [key]: value })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  return (
    <section className="bg-surface rounded-xl shadow-sm p-5">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
        <BellIcon className="w-5 h-5 text-primary" />
        การแจ้งเตือน LINE
      </h2>

      {!connection ? (
        <div className="text-center py-6">
          <p className="text-text-secondary mb-4">ยังไม่ได้เชื่อมต่อกับ LINE</p>
          <button
            onClick={connectLine}
            className="px-4 py-2 bg-[#00B900] text-white rounded-lg font-medium hover:bg-[#009900]"
          >
            เชื่อมต่อ LINE
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
            <CheckCircleIcon className="w-5 h-5 text-success" />
            <span className="text-sm text-success">เชื่อมต่อแล้ว</span>
          </div>

          <div className="space-y-3">
            {/* Daily Summary */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">สรุปรายวัน</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  รับสรุปกิจกรรมและงานประจำวัน
                </p>
              </div>
              <Switch
                checked={settings?.daily_summary_enabled ?? true}
                onChange={(checked) => updateSettings('daily_summary_enabled', checked)}
              />
            </div>

            {settings?.daily_summary_enabled && (
              <div className="ml-4 flex items-center gap-2">
                <label className="text-sm text-text-secondary">เวลา:</label>
                <input
                  type="time"
                  value={settings.daily_summary_time}
                  onChange={(e) => updateSettings('daily_summary_time', e.target.value)}
                  className="px-2 py-1 border border-border rounded"
                />
              </div>
            )}

            <div className="border-t border-border pt-3" />

            {/* Event Reminder */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">เตือนกิจกรรม</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  แจ้งเตือนก่อนกิจกรรมเริ่ม
                </p>
              </div>
              <Switch
                checked={settings?.event_reminder_enabled ?? true}
                onChange={(checked) => updateSettings('event_reminder_enabled', checked)}
              />
            </div>

            {settings?.event_reminder_enabled && (
              <div className="ml-4 flex items-center gap-2">
                <label className="text-sm text-text-secondary">เตือนก่อน:</label>
                <input
                  type="number"
                  value={settings.event_reminder_minutes}
                  onChange={(e) => updateSettings('event_reminder_minutes', parseInt(e.target.value))}
                  min="1"
                  max="60"
                  className="w-16 px-2 py-1 border border-border rounded"
                />
                <span className="text-sm text-text-secondary">นาที</span>
              </div>
            )}
          </div>

          <button
            onClick={disconnectLine}
            className="w-full mt-4 px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-medium hover:bg-error/20"
          >
            ตัดการเชื่อมต่อ
          </button>
        </div>
      )}
    </section>
  );
}
```

#### Logout Section

```tsx
// components/settings/LogoutSection.tsx
export default function LogoutSection() {
  const handleLogout = async () => {
    if (!confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) return;

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <section className="bg-surface rounded-xl shadow-sm p-5">
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-error hover:bg-error/10 rounded-lg transition-colors"
      >
        <LogoutIcon className="w-5 h-5" />
        <span className="font-medium">ออกจากระบบ</span>
      </button>
    </section>
  );
}
```

## Responsive Design

### Mobile (< 768px)
- Bottom tab navigation
- Full-width sections
- Simplified cards
- Touch-optimized buttons (min 44x44px)

### Tablet (768px - 1024px)
- Side navigation appears
- Max width containers (768px)
- Cards in grid layout

### Desktop (> 1024px)
- Max width 1280px
- Multi-column layouts
- Hover states enabled
- Keyboard shortcuts supported

## Accessibility

- Semantic HTML elements
- ARIA labels for icons
- Keyboard navigation support
- Focus indicators
- Screen reader friendly
- Sufficient color contrast (WCAG AA)

## Performance

- Lazy load components
- Image optimization with Next.js Image
- Virtual scrolling for long lists
- Debounced search/input
- Client-side caching with SWR
- Optimistic UI updates

## Animations

- Smooth transitions (200-300ms)
- Fade in for new messages
- Slide up for modals
- Pulse for voice recording
- Skeleton loaders for loading states

## Thai Language Support

- Noto Sans Thai font for proper rendering
- Buddhist Era (พ.ศ.) for dates
- Thai number formatting
- Proper line breaking for Thai text
- Thai keyboard support
