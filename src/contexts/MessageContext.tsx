import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { database } from '../config/firebase';
import { ref, onChildAdded, off, get, update, onValue } from 'firebase/database';
import { notificationSound } from '../utils/notificationSound';

interface MessageContextType {
  unreadMessageCount: number;
  setUnreadMessageCount: (count: number) => void;
  markMessagesAsRead: () => Promise<void>;
  resetUnreadCount: () => void;
}

export const MessageContext = createContext<MessageContextType>({
  unreadMessageCount: 0,
  setUnreadMessageCount: () => {},
  markMessagesAsRead: async () => {},
  resetUnreadCount: () => {}
});

export const useMessageContext = () => useContext(MessageContext);

interface MessageProviderProps {
  userId: string | null;
  rideId: string | null;
  children: React.ReactNode;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({ userId, rideId, children }) => {
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const previousUnreadCount = useRef(0);

  useEffect(() => {
    if (!rideId) {
      setUnreadMessageCount(0);
      return;
    }

    // Load cached unread count from localStorage
    const cachedCount = localStorage.getItem(`unread_${rideId}`);
    if (cachedCount) {
      setUnreadMessageCount(parseInt(cachedCount, 10));
    }

    // Listen to all messages in real-time
    const messagesRef = ref(database, `rides/${rideId}/messages`);
    let hasInitialLoad = false;

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setUnreadMessageCount(0);
        localStorage.setItem(`unread_${rideId}`, '0');
        return;
      }

      let unreadCount = 0;
      const messages: any[] = [];

      snapshot.forEach((childSnapshot) => {
        const msg = childSnapshot.val();
        messages.push({ id: childSnapshot.key, ...msg });
        if (msg.sender === 'driver' && !msg.read) {
          unreadCount++;
        }
      });

      setUnreadMessageCount(unreadCount);
      localStorage.setItem(`unread_${rideId}`, unreadCount.toString());

      // Play notification sound if unread count increased
      if (unreadCount > previousUnreadCount.current && hasInitialLoad) {
        notificationSound.play();
      }
      previousUnreadCount.current = unreadCount;
      hasInitialLoad = true;

      // Cache messages for offline support
      localStorage.setItem(`messages_${rideId}`, JSON.stringify(messages));
    });

    return () => {
      off(messagesRef, 'value', unsubscribe);
    };
  }, [rideId]);

  // Listen for ride completion to auto-clear messages
  useEffect(() => {
    if (!rideId) return;

    const statusRef = ref(database, `rides/${rideId}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status === 'completed') {
        // Clear local cache
        localStorage.removeItem(`messages_${rideId}`);
        localStorage.removeItem(`unread_${rideId}`);
        setUnreadMessageCount(0);
      }
    });

    return () => {
      off(statusRef, 'value', unsubscribe);
    };
  }, [rideId]);

  const markMessagesAsRead = async () => {
    if (!rideId) return;

    try {
      const messagesRef = ref(database, `rides/${rideId}/messages`);
      const snapshot = await get(messagesRef);

      if (snapshot.exists()) {
        const updates: { [key: string]: any } = {};

        snapshot.forEach((childSnapshot) => {
          const msg = childSnapshot.val();
          if (msg.sender === 'driver' && !msg.read) {
            updates[`${childSnapshot.key}/read`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          await update(messagesRef, updates);
        }

        setUnreadMessageCount(0);
        localStorage.setItem(`unread_${rideId}`, '0');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const resetUnreadCount = () => {
    setUnreadMessageCount(0);
    if (rideId) {
      localStorage.setItem(`unread_${rideId}`, '0');
    }
  };

  return (
    <MessageContext.Provider value={{ unreadMessageCount, setUnreadMessageCount, markMessagesAsRead, resetUnreadCount }}>
      {children}
    </MessageContext.Provider>
  );
};