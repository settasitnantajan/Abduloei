'use client';

import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { ParsedCommand } from '@/lib/types/command';
import CommandCard from './CommandCard';

interface ChatMessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: {
    command?: ParsedCommand;
    parsed?: boolean;
    executed?: boolean;
    pending_confirmation?: boolean;
  };
  onConfirmCommand?: () => Promise<void>;
  onCancelCommand?: () => Promise<void>;
  searchQuery?: string;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const parts: Array<{ text: string; highlight: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerQuery, lastIndex);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false });
    }
    parts.push({ text: text.slice(index, index + query.length), highlight: true });
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-400/40 text-white rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

export default function ChatMessage({
  id,
  role,
  content,
  createdAt,
  metadata,
  onConfirmCommand,
  onCancelCommand,
  searchQuery = '',
}: ChatMessageProps) {
  const isUser = role === 'user';
  const hasCommand = metadata?.parsed && metadata?.command;

  // ลบ markdown formatting ที่ Gemini ส่งมา เช่น **bold**, *italic*, ### heading
  const cleanContent = content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '');

  const relativeTime = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: th,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-[#2A2A2A] text-white rounded-br-sm'
              : 'bg-[#00B900] text-white rounded-bl-sm'
          }`}
        >
          <p className="text-sm md:text-base whitespace-pre-wrap break-words">
            <HighlightedText text={cleanContent} query={searchQuery} />
          </p>
        </div>

        {/* Show CommandCard if command was parsed */}
        {hasCommand && metadata.command && (
          <div className="mt-2 w-full">
            <CommandCard
              command={metadata.command}
              executed={metadata.executed || false}
              pending={metadata.pending_confirmation || false}
              onConfirm={onConfirmCommand}
              onCancel={onCancelCommand}
            />
          </div>
        )}

        <span className="text-xs text-gray-500 mt-1 px-2">
          {relativeTime}
        </span>
      </div>
    </motion.div>
  );
}
