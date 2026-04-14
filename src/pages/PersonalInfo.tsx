import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';

export const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useUserProfile();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    email: profile?.email || ''
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setTempValues({
        name: profile.name,
        phone: profile.phone,
        email: profile.email
      });
    }
  }, [profile]);

  const handleEdit = (field: string) => {
    setEditingField(field);
    setTempValues({
      name: profile?.name || '',
      phone: profile?.phone || '',
      email: profile?.email || ''
    });
  };

  const handleSave = async (field: string) => {
    try {
      setSaving(true);
      
      // Save complete profile with updated field
      await updateProfile({
        name: tempValues.name,
        phone: tempValues.phone,
        email: tempValues.email,
        profilePicture: profile?.profilePicture
      });
      
      setEditingField(null);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempValues({
      name: profile?.name || '',
      phone: profile?.phone || '',
      email: profile?.email || ''
    });
    setEditingField(null);
  };

  const infoFields = [
    { key: 'name', label: 'Name', value: profile?.name || '', type: 'text' },
    { key: 'phone', label: 'Cell number', value: profile?.phone || '', type: 'tel' },
    { key: 'email', label: 'Email', value: profile?.email || '', type: 'email' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div 
        className="bg-white p-4 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/account')}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-800" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Personal info</h1>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div 
        className="p-4 mt-6"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {infoFields.map((field, index) => (
            <div
              key={field.key}
              className={`p-4 ${index !== infoFields.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">{field.label}</label>
                {editingField !== field.key && (
                  <button
                    onClick={() => handleEdit(field.key)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Edit size={16} className="text-gray-500" />
                  </button>
                )}
              </div>
              
              {editingField === field.key ? (
                <div className="space-y-3">
                  <input
                    type={field.type}
                    value={tempValues[field.key as keyof typeof tempValues]}
                    onChange={(e) => setTempValues(prev => ({
                      ...prev,
                      [field.key]: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSave(field.key)}
                      disabled={saving}
                      className={`flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors ${
                        saving ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-900 font-medium">{field.value}</p>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};