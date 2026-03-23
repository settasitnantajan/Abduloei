'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Search, X, ChevronUp, ChevronDown, ArrowDown } from 'lucide-react';

import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import TypingIndicator from '@/components/chat/TypingIndicator';
import { getChatMessages } from '@/app/actions/chat';

import type { ChatMessage as ChatMessageType, ChatConversation } from '@/app/actions/chat';

interface ChatClientProps {
  initialConversation: ChatConversation;
  initialMessages: ChatMessageType[];
  initialHasMore: boolean;
}

export default function ChatClient({ initialConversation, initialMessages, initialHasMore }: ChatClientProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showScrollDown, setShowScrollDown] = useState(false);

  const shouldScrollRef = useRef(true);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (shouldScrollRef.current) {
      scrollToBottom();
    }
    shouldScrollRef.current = true;
  }, [messages, isTyping]);

  // Detect scroll position to show/hide scroll-down button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollDown(distanceFromBottom > 300);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(-1);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    messages.forEach((msg, i) => {
      if (msg.content.toLowerCase().includes(query)) {
        results.push(i);
      }
    });
    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  // Jump to search result
  useEffect(() => {
    if (currentResultIndex < 0 || searchResults.length === 0) return;
    const msgIndex = searchResults[currentResultIndex];
    const msgId = messages[msgIndex]?.id;
    if (!msgId) return;

    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentResultIndex, searchResults, messages]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentResultIndex(-1);
  };

  const goToPrevResult = () => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex(prev => (prev <= 0 ? searchResults.length - 1 : prev - 1));
  };

  const goToNextResult = () => {
    if (searchResults.length === 0) return;
    setCurrentResultIndex(prev => (prev >= searchResults.length - 1 ? 0 : prev + 1));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrevResult();
      } else {
        goToNextResult();
      }
    }
    if (e.key === 'Escape') {
      handleSearchClose();
    }
  };

  // Get highlighted message id
  const highlightedMsgId = currentResultIndex >= 0 && searchResults.length > 0
    ? messages[searchResults[currentResultIndex]]?.id
    : null;

  // Load older messages
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = messages[0];
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const { messages: olderMessages, hasMore: moreAvailable } = await getChatMessages(
        initialConversation.id,
        50,
        oldestMessage.created_at
      );

      if (olderMessages.length > 0) {
        shouldScrollRef.current = false;
        setMessages(prev => [...olderMessages, ...prev]);
        setHasMore(moreAvailable);

        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message handler (Optimistic UI — ข้อความ user ขึ้นขวาทันที)
  const handleSendMessage = async (messageContent: string) => {
    if (!initialConversation) {
      toast.error('ไม่พบการสนทนา กรุณาโหลดหน้าใหม่');
      return;
    }

    // แสดง user message ทันทีก่อนรอ API
    const optimisticId = `temp-${Date.now()}`;
    const optimisticUserMsg: ChatMessageType = {
      id: optimisticId,
      conversation_id: initialConversation.id,
      role: 'user' as const,
      content: messageContent,
      created_at: new Date().toISOString(),
      metadata: undefined,
    };
    setMessages(prev => [...prev, optimisticUserMsg]);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: initialConversation.id,
          message: messageContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'ไม่สามารถส่งข้อความได้');
      }

      // แทนที่ optimistic message ด้วย real message + เพิ่ม AI response
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId),
        data.userMessage,
        data.aiMessage,
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      // ลบ optimistic message ออกเมื่อ error
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถส่งข้อความได้');
    } finally {
      setIsTyping(false);
    }
  };

  // Confirm command handler
  const handleConfirmCommand = async () => {
    let commandMessageId: string | null = null;
    setMessages(prev => prev.map(msg => {
      if (msg.metadata && typeof msg.metadata === 'object' && 'pending_confirmation' in msg.metadata && msg.metadata.pending_confirmation) {
        commandMessageId = msg.id;
        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            executed: true,
            pending_confirmation: false
          }
        };
      }
      return msg;
    }));

    await handleSendMessage('ใช่ ยืนยัน');

    if (commandMessageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id === commandMessageId) {
          return {
            ...msg,
            metadata: {
              ...(msg.metadata || {}),
              executed: true,
              pending_confirmation: false
            }
          };
        }
        return msg;
      }));
    }
  };

  // Cancel command handler
  const handleCancelCommand = async () => {
    let commandMessageId: string | null = null;
    setMessages(prev => prev.map(msg => {
      if (msg.metadata && typeof msg.metadata === 'object' && 'pending_confirmation' in msg.metadata && msg.metadata.pending_confirmation) {
        commandMessageId = msg.id;
        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            executed: false,
            pending_confirmation: false
          }
        };
      }
      return msg;
    }));

    await handleSendMessage('ไม่ ยกเลิก');

    if (commandMessageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id === commandMessageId) {
          return {
            ...msg,
            metadata: {
              ...(msg.metadata || {}),
              executed: false,
              pending_confirmation: false
            }
          };
        }
        return msg;
      }));
    }
  };


  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Search Bar */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#1A1A1A] border-b border-[#333333] overflow-hidden z-10"
          >
            <div className="max-w-4xl mx-auto flex items-center gap-2 px-4 py-2.5">
              <Search className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="ค้นหาข้อความ..."
                className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
              />
              {searchResults.length > 0 && (
                <span className="text-xs text-gray-400 shrink-0">
                  {currentResultIndex + 1}/{searchResults.length}
                </span>
              )}
              {searchQuery && searchResults.length === 0 && (
                <span className="text-xs text-gray-500 shrink-0">ไม่พบ</span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={goToPrevResult}
                  disabled={searchResults.length === 0}
                  className="p-1.5 rounded hover:bg-[#2A2A2A] text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={goToNextResult}
                  disabled={searchResults.length === 0}
                  className="p-1.5 rounded hover:bg-[#2A2A2A] text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSearchClose}
                className="p-1.5 rounded hover:bg-[#2A2A2A] text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Toggle Button (fixed top-right) */}
      {!isSearchOpen && (
        <button
          onClick={handleSearchOpen}
          className="fixed top-4 right-4 md:right-8 z-20 p-2.5 rounded-xl bg-[#1A1A1A] border border-[#333333] text-gray-400 hover:text-white hover:border-[#555555] transition-colors"
          title="ค้นหาข้อความ"
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6"
        style={{ maxHeight: isSearchOpen ? 'calc(100vh - 130px)' : 'calc(100vh - 80px)' }}
      >
        <div className="max-w-4xl mx-auto">
          {/* ปุ่มโหลดข้อความเก่า */}
          {hasMore && messages.length > 0 && (
            <div className="text-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-sm text-gray-400 hover:text-white bg-[#1A1A1A] border border-[#333333] hover:border-[#555555] rounded-full px-4 py-2 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? 'กำลังโหลด...' : 'โหลดข้อความเก่า'}
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 rounded-full bg-[#00B900] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-white">A</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                สวัสดีครับ! ผม Abduloei
              </h2>
              <p className="text-gray-400 mb-6">
                ผู้ช่วยบ้านอัจฉริยะที่พร้อมช่วยเหลือคุณ
              </p>
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-lg p-4 max-w-md mx-auto">
                <p className="text-sm text-gray-400 mb-3">ผมสามารถช่วยคุณได้ใน:</p>
                <ul className="text-sm text-white space-y-2 text-left">
                  <li className="flex items-start">
                    <span className="text-[#00B900] mr-2">•</span>
                    <span>ตอบคำถามทั่วไป</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#00B900] mr-2">•</span>
                    <span>สร้างกิจกรรมและนัดหมาย</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#00B900] mr-2">•</span>
                    <span>จัดการงานที่ต้องทำ</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#00B900] mr-2">•</span>
                    <span>บันทึกข้อมูลสำคัญ</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#00B900] mr-2">•</span>
                    <span>ให้คำแนะนำเกี่ยวกับการจัดการบ้าน</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              {messages.map((msg, i) => {
                const isHighlighted = msg.id === highlightedMsgId;
                const isSearchMatch = searchQuery.trim() !== '' && searchResults.includes(i);

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`transition-all duration-300 rounded-xl ${
                      isHighlighted
                        ? 'bg-[#00B900]/10 ring-1 ring-[#00B900]/30 -mx-2 px-2 py-1'
                        : isSearchMatch
                          ? 'bg-white/5 -mx-1 px-1'
                          : ''
                    }`}
                  >
                    <ChatMessage
                      id={msg.id}
                      role={msg.role}
                      content={msg.content}
                      createdAt={msg.created_at}
                      metadata={msg.metadata as any}
                      onConfirmCommand={handleConfirmCommand}
                      onCancelCommand={handleCancelCommand}
                      searchQuery={searchQuery}
                    />
                  </div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-start mb-4"
            >
              <TypingIndicator />
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={scrollToBottom}
            className="fixed bottom-24 right-4 md:right-8 z-20 w-10 h-10 rounded-full bg-[#2A2A2A] border border-[#444444] text-gray-300 hover:text-white hover:bg-[#333333] flex items-center justify-center shadow-lg transition-colors"
            title="ไปล่างสุด"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
    </div>
  );
}
