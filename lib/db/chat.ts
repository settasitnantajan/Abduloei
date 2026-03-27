import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  home_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get or create a conversation for the current user
 */
export async function getOrCreateConversation(): Promise<{
  conversation: ChatConversation | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { conversation: null, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: existingConversations, error: fetchError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching conversation:', fetchError);
      return { conversation: null, error: 'ไม่สามารถโหลดการสนทนาได้' };
    }

    if (existingConversations && existingConversations.length > 0) {
      return { conversation: existingConversations[0], error: null };
    }

    const { data: newConversation, error: createError } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        title: 'การสนทนาใหม่',
        home_id: null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      return { conversation: null, error: 'ไม่สามารถสร้างการสนทนาได้' };
    }

    return { conversation: newConversation, error: null };
  } catch (error) {
    console.error('Unexpected error in getOrCreateConversation:', error);
    return { conversation: null, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Get chat messages for a conversation
 */
export async function getChatMessages(conversationId: string, limit = 50, before?: string): Promise<{
  messages: ChatMessage[];
  hasMore: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { messages: [], hasMore: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return { messages: [], hasMore: false, error: 'ไม่พบการสนทนานี้' };
    }

    // ดึงข้อความใหม่สุด N+1 ข้อความ (เพื่อเช็ค hasMore)
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // ถ้ามี before → ดึงข้อความที่เก่ากว่า
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: rawMessages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return { messages: [], hasMore: false, error: 'ไม่สามารถโหลดข้อความได้' };
    }

    const hasMore = (rawMessages?.length || 0) > limit;
    const trimmed = rawMessages ? rawMessages.slice(0, limit) : [];
    const messages = [...trimmed].reverse(); // เรียงเก่า→ใหม่

    return { messages, hasMore, error: null };
  } catch (error) {
    console.error('Unexpected error in getChatMessages:', error);
    return { messages: [], hasMore: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Save a chat message
 */
export async function saveChatMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
): Promise<{
  message: ChatMessage | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { message: null, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, title')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return { message: null, error: 'ไม่พบการสนทนานี้' };
    }

    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      return { message: null, error: 'ไม่สามารถบันทึกข้อความได้' };
    }

    if (role === 'user' && conversation.title === 'การสนทนาใหม่') {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await supabase
        .from('chat_conversations')
        .update({ title })
        .eq('id', conversationId);
    }

    revalidatePath('/chat');

    return { message, error: null };
  } catch (error) {
    console.error('Unexpected error in saveChatMessage:', error);
    return { message: null, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Query commands from conversation metadata
 */
export async function queryCommands(conversationId: string): Promise<{
  commands: Array<{
    type: string;
    title: string;
    date?: string;
    time?: string;
    executed: boolean;
    createdAt: string;
  }>;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { commands: [], error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return { commands: [], error: 'ไม่พบการสนทนานี้' };
    }

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('metadata, created_at')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .not('metadata->parsed', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (messagesError) {
      console.error('Error querying commands:', messagesError);
      return { commands: [], error: 'ไม่สามารถค้นหาคำสั่งได้' };
    }

    const commands = (messages || [])
      .filter((msg: any) => msg.metadata?.parsed === true && msg.metadata?.command)
      .map((msg: any) => ({
        type: msg.metadata.command.type,
        title: msg.metadata.command.title,
        date: msg.metadata.command.date,
        time: msg.metadata.command.time,
        executed: msg.metadata.executed || false,
        createdAt: msg.created_at,
      }));

    return { commands, error: null };
  } catch (error) {
    console.error('Unexpected error in queryCommands:', error);
    return { commands: [], error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Get pending command from conversation
 */
export async function getPendingCommand(conversationId: string): Promise<{
  message: ChatMessage | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { message: null, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return { message: null, error: 'ไม่พบการสนทนานี้' };
    }

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .eq('metadata->>pending_confirmation', 'true')
      .order('created_at', { ascending: false })
      .limit(1);

    if (messagesError) {
      console.error('Error fetching pending command:', messagesError);
      return { message: null, error: 'ไม่สามารถค้นหาคำสั่งได้' };
    }

    if (!messages || messages.length === 0) {
      return { message: null, error: null };
    }

    return { message: messages[0], error: null };
  } catch (error) {
    console.error('Unexpected error in getPendingCommand:', error);
    return { message: null, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Mark a command as executed
 */
export async function markCommandExecuted(
  messageId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*, chat_conversations!inner(user_id)')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return { success: false, error: 'ไม่พบข้อความนี้' };
    }

    if ((message as any).chat_conversations.user_id !== user.id) {
      return { success: false, error: 'ไม่มีสิทธิ์แก้ไขข้อความนี้' };
    }

    const updatedMetadata = {
      ...((message as any).metadata || {}),
      executed: true,
      executedAt: new Date().toISOString(),
      pending_confirmation: false,
    };

    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ metadata: updatedMetadata })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error marking command as executed:', updateError);
      return { success: false, error: 'ไม่สามารถอัพเดทสถานะได้' };
    }

    revalidatePath('/chat');

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error in markCommandExecuted:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Clear command metadata in a conversation (mark as deleted)
 * สามารถ filter ตามวันที่และประเภทได้
 */
export async function clearAllCommands(
  conversationId: string,
  filterDate?: string,
  filterType?: string,
  titleKeyword?: string
): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, count: 0, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    // ดึง messages ที่มี command metadata
    const { data: messages, error: fetchError } = await supabase
      .from('chat_messages')
      .select('id, metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .not('metadata->parsed', 'is', null);

    if (fetchError) {
      return { success: false, count: 0, error: 'ไม่สามารถค้นหาคำสั่งได้' };
    }

    let commandMessages = (messages || []).filter(
      (msg: any) => msg.metadata?.parsed === true && msg.metadata?.command
    );

    // Filter ตามเงื่อนไข
    if (filterDate) {
      commandMessages = commandMessages.filter(
        (msg: any) => msg.metadata?.command?.date === filterDate
      );
    }
    if (filterType) {
      commandMessages = commandMessages.filter(
        (msg: any) => msg.metadata?.command?.type === filterType
      );
    }
    if (titleKeyword) {
      const keyword = titleKeyword.toLowerCase();
      commandMessages = commandMessages.filter(
        (msg: any) => msg.metadata?.command?.title?.toLowerCase()?.includes(keyword)
      );
    }

    // Mark คำสั่งที่ตรง filter ว่า deleted
    for (const msg of commandMessages) {
      const updatedMetadata = {
        ...((msg as any).metadata || {}),
        deleted: true,
        parsed: false,
        pending_confirmation: false,
      };
      await supabase
        .from('chat_messages')
        .update({ metadata: updatedMetadata })
        .eq('id', msg.id);
    }

    return { success: true, count: commandMessages.length, error: null };
  } catch (error) {
    console.error('Unexpected error in clearAllCommands:', error);
    return { success: false, count: 0, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * Mark a command as rejected
 */
export async function markCommandRejected(
  messageId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' };
    }

    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*, chat_conversations!inner(user_id)')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return { success: false, error: 'ไม่พบข้อความนี้' };
    }

    if ((message as any).chat_conversations.user_id !== user.id) {
      return { success: false, error: 'ไม่มีสิทธิ์แก้ไขข้อความนี้' };
    }

    const updatedMetadata = {
      ...((message as any).metadata || {}),
      rejected: true,
      pending_confirmation: false,
    };

    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ metadata: updatedMetadata })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error marking command as rejected:', updateError);
      return { success: false, error: 'ไม่สามารถอัพเดทสถานะได้' };
    }

    revalidatePath('/chat');

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error in markCommandRejected:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}

/**
 * ลบข้อความทั้งหมดใน conversation
 */
export async function clearChatMessages(
  conversationId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await adminClient
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('Error clearing chat messages:', error);
      return { success: false, error: 'ไม่สามารถล้างแชทได้' };
    }

    revalidatePath('/chat');
    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error in clearChatMessages:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด' };
  }
}
