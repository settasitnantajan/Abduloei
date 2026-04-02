import ChatClient from '@/components/chat/ChatClient';
import ChatErrorState from '@/components/chat/ChatErrorState';
import { getOrCreateConversation, getChatMessages, getUserConversations } from '@/app/actions/chat';

// Mark as dynamic route (uses cookies for auth)
export const dynamic = 'force-dynamic';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const params = await searchParams;
  const roomId = params.room;

  const { conversation, error: convError } = await getOrCreateConversation(roomId);

  if (convError || !conversation) {
    return <ChatErrorState error={convError || 'ไม่สามารถโหลดการสนทนาได้'} />;
  }

  const { messages, hasMore } = await getChatMessages(conversation.id);
  const { conversations } = await getUserConversations();

  return (
    <ChatClient
      initialConversation={conversation}
      initialMessages={messages || []}
      initialHasMore={hasMore}
      conversations={conversations}
    />
  );
}
