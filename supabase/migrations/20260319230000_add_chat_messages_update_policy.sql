-- Add missing UPDATE policy for chat_messages
-- (markCommandExecuted / markCommandRejected needs this to update metadata)
CREATE POLICY "Users can update messages in their conversations"
  ON chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );
