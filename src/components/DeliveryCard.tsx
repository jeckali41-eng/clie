import React from 'react';
import { motion } from 'framer-motion';

interface DeliveryMode {
  id: 'motorbike' | 'car' | 'bicycle';
  label: string;
  time: string;
  description: string;
  deliveryFee: number;
  icon: string;
}

interface DeliveryCardProps {
  mode: DeliveryMode;
  subtotal: number;
  totalItemCount: number;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

export function DeliveryCard({
  mode,
  subtotal,
  totalItemCount,
  isSelected,
  onSelect,
  index
}: DeliveryCardProps) {
  // Each card calculates its own total independently
  const cardTotal = subtotal + mode.deliveryFee;

  return (
    <motion.button
      onClick={onSelect}
      className={`w-full p-4 rounded-2xl transition-all border-2 ${
        isSelected
          ? 'bg-green-50 border-green-600'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 flex-shrink-0 text-3xl flex items-center justify-center">
          {mode.icon}
        </div>

        <div className="flex-1 text-left">
          <h3 className="font-bold text-gray-900 text-base mb-1">{mode.label}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{mode.time}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{mode.description}</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="font-bold text-gray-900 text-lg">
            R {cardTotal}
          </div>
          <div className="text-sm text-gray-500">
            R {mode.deliveryFee}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
