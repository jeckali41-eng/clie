import { database } from '../config/firebase';
import { ref, push, set, onValue, off, remove, get, child, onChildAdded, update, query, orderByChild } from 'firebase/database';
import { RideRequest, UserProfile, DriverInfo, ChatMessage, DriverLocation } from '../types';

const TEST_DRIVER_ID = 'T8GhAVunanZmkz3QMfPZfRsCdzJ2';

class FirebaseService {
  async createRideRequest(rideData: Omit<RideRequest, 'id' | 'timestamp'>): Promise<string> {
    const rideRequest: Omit<RideRequest, 'id'> = {
      ...rideData,
      timestamp: Date.now(),
    };

    const ridesRef = ref(database, 'rides');
    const newRideRef = push(ridesRef);
    const rideId = newRideRef.key!;

    await set(newRideRef, rideRequest);
    await set(ref(database, `rideRequests/${rideId}`), rideRequest);
    await set(ref(database, `drivers/${TEST_DRIVER_ID}/incoming/${rideId}`), rideRequest);

    return rideId;
  }

  // Update ride status (do one atomic write to the status property)
  async updateRideStatus(rideId: string, status: RideRequest['status']): Promise<void> {
    const rideStatusRef = ref(database, `rides/${rideId}/status`);
    console.log('Updating ride status:', { rideId, status });
    await set(rideStatusRef, status);
    console.log('Ride status updated successfully');
  }

  // Do NOT remove the ride on cancel — instead, set status to 'cancelled'
  async cancelRideRequest(rideId: string): Promise<void> {
    // Prefer updating status rather than deleting the ride
    await this.updateRideStatus(rideId, 'cancelled');
  }

  // Save cancellation reason under /cancellations/{rideId}
  async saveCancellationReason(rideId: string, reason: string, userId: string, userName: string): Promise<void> {
    if (!rideId) throw new Error('Missing rideId for cancellation');
    const cancellationRef = ref(database, `cancellations/${rideId}`);
    const cancellationData = {
      rideId,
      cancelledReason: reason,
      cancelledAt: Date.now(),
      userId,
      userName
    };
    console.log('Saving cancellation reason:', cancellationData);
    await set(cancellationRef, cancellationData);
    console.log('Cancellation reason saved successfully');
  }

  // Helper: find the user's most recent active (pending) ride ID
  async findActiveRideByUser(userId: string): Promise<string | null> {
    const ridesRef = ref(database, 'rides');
    const snapshot = await get(ridesRef);
    if (!snapshot.exists()) return null;

    let latestId: string | null = null;
    let latestTimestamp = 0;

    snapshot.forEach((childSnap) => {
      const r = childSnap.val();
      const id = childSnap.key;
      if (r && r.userId === userId && r.status === 'pending') {
        if (!latestId || r.timestamp > latestTimestamp) {
          latestTimestamp = r.timestamp;
          latestId = id!;
        }
      }
    });

    return latestId;
  }

  listenToRideRequest(rideId: string, callback: (ride: RideRequest | null) => void) {
    const rideRef = ref(database, `rides/${rideId}`);
    
    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      if (rideData) {
        callback({ ...rideData, id: rideId });
      } else {
        callback(null);
      }
    });

    return () => off(rideRef, 'value', unsubscribe);
  }

  // User Profile Management
  async saveUserProfile(userId: string, profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const userRef = ref(database, `users/${userId}`);
    const existingUser = await get(userRef);
    
    const now = Date.now();
    const userProfile: UserProfile = {
      ...profile,
      id: userId,
      createdAt: existingUser.exists() ? existingUser.val().createdAt : now,
      updatedAt: now
    };

    await set(userRef, userProfile);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  }

  listenToUserProfile(userId: string, callback: (profile: UserProfile | null) => void) {
    const userRef = ref(database, `users/${userId}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      const userData = snapshot.val();
      callback(userData || null);
    });

    return () => off(userRef, 'value', unsubscribe);
  }

  async getDriverInfo(driverId: string): Promise<DriverInfo | null> {
    const driverRef = ref(database, `drivers/${driverId}`);
    const snapshot = await get(driverRef);

    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  }

  // Ride status tracking
  listenToRideStatus(rideId: string, callback: (status: { status: string; driverId?: string } | null) => void) {
    const rideStatusRef = ref(database, `rides/${rideId}`);
    
    const unsubscribe = onValue(rideStatusRef, (snapshot) => {
      const rideData = snapshot.val();
      if (rideData) {
        callback({
          status: rideData.status,
          driverId: rideData.driverId
        });
      } else {
        callback(null);
      }
    });

    return () => off(rideStatusRef, 'value', unsubscribe);
  }

  async startRide(rideId: string): Promise<void> {
    const rideStatusRef = ref(database, `rides/${rideId}/status`);
    await set(rideStatusRef, 'started');
  }

  listenToDriverLocation(driverId: string, callback: (location: DriverLocation | null) => void) {
    const locationRef = ref(database, `drivers/${driverId}/operation`);

    const unsubscribe = onValue(locationRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.lat && data.lng) {
        callback({
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp || Date.now()
        });
      } else {
        callback(null);
      }
    });

    return () => off(locationRef, 'value', unsubscribe);
  }

  async sendMessage(rideId: string, senderId: string, text: string, sender: 'driver' | 'client', senderName?: string): Promise<string> {
    const messagesRef = ref(database, `rides/${rideId}/messages`);
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key!;

    const message = {
      senderId,
      sender,
      senderName: senderName || (sender === 'client' ? 'Client' : 'Driver'),
      text,
      timestamp: Date.now(),
      read: sender === 'client',
      readBy: {
        [senderId]: true
      }
    };

    await set(newMessageRef, message);
    return messageId;
  }

  listenToMessages(rideId: string, callback: (message: ChatMessage) => void) {
    const messagesRef = ref(database, `rides/${rideId}/messages`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const messages: ChatMessage[] = [];
      snapshot.forEach((childSnapshot) => {
        const messageData = childSnapshot.val();
        if (messageData) {
          messages.push({
            id: childSnapshot.key!,
            ...messageData
          });
        }
      });

      messages.sort((a, b) => a.timestamp - b.timestamp);
      messages.forEach(msg => callback(msg));
    });

    return () => off(messagesRef, 'value', unsubscribe);
  }

  async markMessageAsRead(rideId: string, messageId: string, userId: string): Promise<void> {
    const messageRef = ref(database, `rides/${rideId}/messages/${messageId}`);
    await update(messageRef, {
      read: true,
      [`readBy/${userId}`]: true
    });
  }

  async markAllMessagesAsRead(rideId: string): Promise<void> {
    const messagesRef = ref(database, `rides/${rideId}/messages`);
    const snapshot = await get(messagesRef);

    if (!snapshot.exists()) return;

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
  }

  async getAllMessages(rideId: string): Promise<ChatMessage[]> {
    const messagesRef = ref(database, `rides/${rideId}/messages`);
    const snapshot = await get(messagesRef);

    if (!snapshot.exists()) {
      return [];
    }

    const messages: ChatMessage[] = [];
    snapshot.forEach((childSnap) => {
      messages.push({
        id: childSnap.key!,
        ...childSnap.val()
      });
    });

    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async clearRideMessages(rideId: string): Promise<void> {
    const messagesRef = ref(database, `rides/${rideId}/messages`);
    await remove(messagesRef);
    localStorage.removeItem(`messages_${rideId}`);
    localStorage.removeItem(`unread_${rideId}`);
  }

  listenToRideCompletion(rideId: string, callback: (completed: boolean) => void) {
    const statusRef = ref(database, `rides/${rideId}/status`);

    const unsubscribe = onValue(statusRef, async (snapshot) => {
      const status = snapshot.val();
      if (status === 'completed') {
        await this.clearRideMessages(rideId);
        callback(true);
      }
    });

    return () => off(statusRef, 'value', unsubscribe);
  }

  async submitRating(driverUid: string, rideId: string, score: number, comment: string, userId: string): Promise<void> {
    const ratingRef = ref(database, `ratings/${driverUid}/${rideId}`);
    await set(ratingRef, {
      score,
      comment,
      userId,
      timestamp: Date.now()
    });

    const driverRef = ref(database, `drivers/${driverUid}`);
    const driverSnapshot = await get(driverRef);

    if (driverSnapshot.exists()) {
      const driverData = driverSnapshot.val();
      const existingAverage = driverData.rating || 0;
      const existingCount = driverData.ratingCount || 0;

      const updatedCount = existingCount + 1;
      const updatedAverage = (existingAverage * existingCount + score) / updatedCount;

      await update(driverRef, {
        rating: parseFloat(updatedAverage.toFixed(2)),
        ratingCount: updatedCount
      });
    } else {
      await update(driverRef, {
        rating: score,
        ratingCount: 1
      });
    }

    await update(ref(database, `rides/${rideId}`), {
      rated: true
    });
  }

  listenToDriverLocationAndETA(
    rideId: string,
    callback: (data: { location: { lat: number; lng: number }; eta: string }) => void
  ) {
    const rideRef = ref(database, `rides/${rideId}`);

    const unsubscribe = onValue(rideRef, (snapshot) => {
      const rideData = snapshot.val();
      if (!rideData || !rideData.driverLocation) return;

      const { lat, lng } = rideData.driverLocation;
      const eta = rideData.driverETA || '3 mins';

      callback({ location: { lat, lng }, eta });
    });

    return () => off(rideRef, 'value', unsubscribe);
  }
}

export const firebaseService = new FirebaseService();
