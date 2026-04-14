 import { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../services/firebaseService';
import { UserProfile } from '../types';

export const useUserProfile = (userId: string = 'user123') => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial profile data
    const loadProfile = async () => {
      try {
        const userProfile = await firebaseService.getUserProfile(userId);
        setProfile(userProfile);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    // Listen for real-time updates
    const unsubscribe = firebaseService.listenToUserProfile(userId, (userProfile) => {
      setProfile(userProfile);
      if (loading) setLoading(false);
    });

    return unsubscribe;
  }, [userId, loading]);

  const updateProfile = useCallback(async (profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setError(null);
      await firebaseService.saveUserProfile(userId, profileData);
      // Profile will be updated via the listener
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    }
  }, [userId]);

  const uploadProfilePicture = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  return {
    profile,
    loading,
    error,
    updateProfile,
    uploadProfilePicture
  };
};