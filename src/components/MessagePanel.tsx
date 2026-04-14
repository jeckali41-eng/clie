import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { ChatMessage } from '../types';
import { ChatMessageBubble } from './ChatMessageBubble';
import { database } from '../config/firebase';
import { ref, onValue, off, push, set, get, remove, update } from 'firebase/database';
import { useMessageContext } from '../contexts/MessageContext';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentUserId: string;
  currentUserName?: string;
  driverId: string;
  driverName: string;
  isRideActive: boolean;
}

interface FirebaseMessage {
  text: string;
  sender: string;
  senderName?: string;
  timestamp: number;
}

export const MessagePanel: React.FC<MessagePanelProps> = ({
  isOpen,
  onClose,
  rideId,
  currentUserId,
  currentUserName = 'You',
  driverId,
  driverName,
  isRideActive
}) => {
  const { markMessagesAsRead } = useMessageContext();
  const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: string; timestamp: number; senderName?: string; read?: boolean }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load cached messages when offline
  useEffect(() => {
    if (!rideId) return;

    const cachedMessages = localStorage.getItem(`messages_${rideId}`);
    if (cachedMessages) {
      try {
        const parsed = JSON.parse(cachedMessages);
        setMessages(parsed.sort((a: any, b: any) => a.timestamp - b.timestamp));
      } catch (error) {
        console.error('Error loading cached messages:', error);
      }
    }
  }, [rideId]);

  // Listen to messages in real-time when panel is opened
  useEffect(() => {
    if (!isOpen || !rideId) return;

    const messagesRef = ref(database, `rides/${rideId}/messages`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setMessages([]);
        localStorage.setItem(`messages_${rideId}`, JSON.stringify([]));
        return;
      }

      const loadedMessages: Array<{ id: string; text: string; sender: string; timestamp: number; senderName?: string; read?: boolean }> = [];

      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        loadedMessages.push({
          id: childSnapshot.key!,
          text: data.text,
          sender: data.sender,
          senderName: data.senderName,
          timestamp: data.timestamp,
          read: data.read || false
        });
      });

      const sortedMessages = loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(sortedMessages);

      // Cache for offline access
      localStorage.setItem(`messages_${rideId}`, JSON.stringify(sortedMessages));
    });

    return () => {
      off(messagesRef, 'value', unsubscribe);
    };
  }, [isOpen, rideId]);

  // Mark messages as read when panel is opened
  useEffect(() => {
    if (isOpen && rideId) {
      markMessagesAsRead();
    }
  }, [isOpen, rideId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clear messages when ride is completed
  useEffect(() => {
    if (!rideId) return;

    const statusRef = ref(database, `rides/${rideId}/status`);
    const unsubscribe = onValue(statusRef, async (snapshot) => {
      const status = snapshot.val();
      if (status === 'completed') {
        try {
          const messagesRef = ref(database, `rides/${rideId}/messages`);
          await remove(messagesRef);
          setMessages([]);
          localStorage.removeItem(`messages_${rideId}`);
        } catch (error) {
          console.error('Error clearing messages on completion:', error);
        }
      }
    });

    return () => {
      off(statusRef, 'value', unsubscribe);
    };
  }, [rideId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isRideActive || isSending) return;

    setIsSending(true);
    try {
      const messagesRef = ref(database, `rides/${rideId}/messages`);
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, {
        text: newMessage.trim(),
        sender: 'client',
        senderName: currentUserName,
        timestamp: Date.now(),
        read: true
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] flex flex-col will-change-transform"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Messages</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-2"
              style={{ maxHeight: 'calc(70vh - 140px)' }}
            >
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessageBubble
                    key={message.id}
                    message={{
                      id: message.id,
                      senderId: message.sender === 'client' ? currentUserId : driverId,
                      text: message.text,
                      timestamp: message.timestamp,
                      readBy: {}
                    }}
                    isCurrentUser={message.sender === 'client'}
                    senderName={message.sender === 'client' ? 'You' : driverName}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isRideActive ? 'Type a message...' : 'Ride not active'}
                  disabled={!isRideActive || isSending}
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isRideActive || isSending}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    newMessage.trim() && isRideActive && !isSending
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
