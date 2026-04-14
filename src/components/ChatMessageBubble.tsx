import React from 'react';
import { motion } from 'framer-motion';
import { ChatMessage } from '../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  senderName: string;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  isCurrentUser,
  senderName
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="text-xs text-gray-500 mb-1 px-2">
          {senderName}
        </div>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isCurrentUser
              ? 'bg-green-500 text-white rounded-br-sm'
              : 'bg-gray-200 text-gray-900 rounded-bl-sm'
          }`}
        >
          <p className="text-sm break-words">{message.text}</p>
        </div>
        <div className="text-xs text-gray-400 mt-1 px-2">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
};