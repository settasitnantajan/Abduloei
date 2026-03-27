'use server';

import * as chatDb from '@/lib/db/chat';

export type ChatMessage = chatDb.ChatMessage;
export type ChatConversation = chatDb.ChatConversation;

export async function getOrCreateConversation() {
  return chatDb.getOrCreateConversation();
}

export async function getChatMessages(conversationId: string, limit = 50, before?: string) {
  return chatDb.getChatMessages(conversationId, limit, before);
}

export async function saveChatMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
) {
  return chatDb.saveChatMessage(conversationId, role, content, metadata);
}

export async function queryCommands(conversationId: string) {
  return chatDb.queryCommands(conversationId);
}

export async function getPendingCommand(conversationId: string) {
  return chatDb.getPendingCommand(conversationId);
}

export async function markCommandExecuted(messageId: string) {
  return chatDb.markCommandExecuted(messageId);
}

export async function markCommandRejected(messageId: string) {
  return chatDb.markCommandRejected(messageId);
}

export async function clearChat(conversationId: string) {
  return chatDb.clearChatMessages(conversationId);
}
