import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  User, 
  Users, 
  Shield, 
  Lock, 
  Eye, 
  Home as HomeIcon, 
  Briefcase, 
  MapPin, 
  Globe, 
  MessageSquare, 
  Calendar, 
  Moon, 
  LogOut, 
  Trash2,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '../components/BottomNavigation';
import { ScrollableSection } from '../components/ScrollableSection';
import { useUserProfile } from '../hooks/useUserProfile';

export const Account: React.FC = () => {
  const navigate = useNavigate();
  const { profile, uploadProfilePicture, updateProfile } = useUserProfile();
  const [uploading, setUploading] = useState(false);

  const userInfo = {
    name: profile?.name || 'User',
    rating: 4.55
  };

  const accountSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Personal info', action: () => navigate('/personal-info') },
        { icon: Users, label: 'Family profile', action: () => {} },
        { icon: Shield, label: 'Safety', action: () => {} },
        { icon: Lock, label: 'Login & security', action: () => {} },
        { icon: Eye, label: 'Privacy', action: () => {} }
      ]
    },
    {
      title: 'Saved places',
      items: [
        { icon: HomeIcon, label: 'Enter home location', action: () => {} },
        { icon: Briefcase, label: 'Enter work location', action: () => {} },
        { icon: Plus, label: 'Add a place', action: () => {} }
      ]
    },
    {
      title: 'Settings',
      items: [
        { icon: Globe, label: 'Language', subtitle: 'English - US', action: () => {} },
        { icon: MessageSquare, label: 'Communication preferences', action: () => {} },
        { icon: Calendar, label: 'Calendars', action: () => {} },
        { icon: Moon, label: 'Dark mode', action: () => {}, toggle: true }
      ]
    },
    {
      title: 'Account Actions',
      items: [
        { icon: LogOut, label: 'Log out', action: () => {}, danger: false },
        { icon: Trash2, label: 'Delete account', action: () => {}, danger: true }
      ]
    }
  ];

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          setUploading(true);
          const base64Image = await uploadProfilePicture(file);
          
          // Update profile with new image
          await updateProfile({
            name: profile?.name || 'User',
            phone: profile?.phone || '',
            email: profile?.email || '',
            profilePicture: base64Image
          });
        } catch (error) {
          console.error('Failed to upload image:', error);
          alert('Failed to upload image. Please try again.');
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Profile */}
      <motion.div 
        className="bg-white pt-12 pb-6"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="text-center">
          <div className="relative inline-block mb-4">
            {profile?.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {userInfo.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <button
              onClick={handleImageUpload}
              disabled={uploading}
              className={`absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors ${
                uploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={16} className="text-white" />
              )}
            </button>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">{userInfo.name}</h2>
          <div className="flex items-center justify-center space-x-1">
            <Star size={16} className="text-green-500 fill-current" />
            <span className="text-green-600 font-medium">{userInfo.rating} Rating</span>
          </div>
        </div>
      </motion.div>

      {/* Update Account Banner */}
      <motion.div 
        className="mx-4 mb-6 bg-green-50 rounded-2xl p-4"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Shield className="text-white" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Let's update your account</h3>
            <p className="text-sm text-gray-600">Improve your app experience</p>
            <p className="text-sm text-green-600 font-medium mt-1">4 new suggestions</p>
          </div>
        </div>
      </motion.div>

      {/* Account Sections */}
      <ScrollableSection maxHeight="max-h-96">
        <div className="px-4 space-y-6 pb-24">
          {accountSections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + sectionIndex * 0.1 }}
            >
              {section.title !== 'Account Actions' && (
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h3>
              )}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {section.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.label}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                        itemIndex !== section.items.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon 
                          size={20} 
                          className={item.danger ? 'text-red-500' : 'text-gray-600'} 
                        />
                        <div className="text-left">
                          <p className={`font-medium ${item.danger ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.label}
                          </p>
                          {item.subtitle && (
                            <p className="text-sm text-gray-500">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      {item.toggle ? (
                        <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                        </div>
                      ) : (
                        <span className="text-gray-400">›</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollableSection>

      <BottomNavigation activeTab="account" />
    </div>
  );
};