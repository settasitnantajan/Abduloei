import ChatClient from '@/components/chat/ChatClient';
import ChatErrorState from '@/components/chat/ChatErrorState';
import { getOrCreateConversation, getChatMessages } from '@/app/actions/chat';

// Mark as dynamic route (uses cookies for auth)
export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  // Fetch data server-side (ปลอดภัย ไม่หลุด key)
  const { conversation, error: convError } = await getOrCreateConversation();

  if (convError || !conversation) {
    return <ChatErrorState error={convError || 'ไม่สามารถโหลดการสนทนาได้'} />;
  }

  const { messages, hasMore } = await getChatMessages(conversation.id);

  // ส่ง data ไปให้ Client Component
  return <ChatClient initialConversation={conversation} initialMessages={messages || []} initialHasMore={hasMore} />;
}
