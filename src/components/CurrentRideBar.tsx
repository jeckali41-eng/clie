import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Car } from 'lucide-react';

interface CurrentRideBarProps {
  driverName: string;
  carModel: string;
  eta: string;
  status: string;
}

export const CurrentRideBar: React.FC<CurrentRideBarProps> = ({ driverName, carModel, eta, status }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/driver-coming') {
    return null;
  }

  const getStatusText = () => {
    if (status === 'accepted') return 'Current Ride';
    if (status === 'arrived') return 'Driver Arrived';
    if (status === 'started') return 'On Trip';
    return 'Current Ride';
  };

  return (
    <motion.div
      className="fixed top-4 right-4 z-40 bg-white rounded-2xl shadow-2xl p-3 cursor-pointer hover:shadow-3xl transition-shadow"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      onClick={() => navigate('/driver-coming')}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center space-x-3 min-w-[200px]">
        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
          <Car size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">{getStatusText()}</p>
          <p className="text-sm font-bold text-gray-900 truncate">{driverName}</p>
          <p className="text-xs text-gray-500 truncate">{carModel} • {eta}</p>
        </div>
      </div>
    </motion.div>
  );
};