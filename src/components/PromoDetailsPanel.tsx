import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface PromoDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  promo: {
    discount: number;
    ridesLeft: number;
    maxPerRide: number;
    expiryDate: string;
    paymentMethods: string;
    rideCategories?: string;
    rideAreas?: string;
  };
}

export const PromoDetailsPanel: React.FC<PromoDetailsPanelProps> = ({
  isOpen,
  onClose,
  promo
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto will-change-transform"
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
            {/* Header with close button */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-2xl font-bold text-gray-900">Promo Details</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Promo Image/Header */}
            <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-white mb-2">{promo.discount}%</div>
                <div className="text-white text-lg font-medium">off {promo.ridesLeft} rides</div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6 pb-20">
              {/* Applied Status */}
              <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-xl">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <span className="text-blue-600 font-medium">Applied to your ride</span>
              </div>

              {/* Details Grid */}
              <div className="space-y-4">
                {/* Maximum promo per ride */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-gray-600 text-sm font-medium mb-1">Maximum promo per ride</p>
                  <p className="text-gray-900 text-lg font-bold">R {promo.maxPerRide}</p>
                </div>

                {/* Expiry Date */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-gray-600 text-sm font-medium mb-1">Expiry date</p>
                  <p className="text-gray-900 text-lg font-bold">{promo.expiryDate}</p>
                </div>

                {/* Rides Left */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-gray-600 text-sm font-medium mb-1">Rides left</p>
                  <p className="text-gray-900 text-lg font-bold">{promo.ridesLeft}/{promo.ridesLeft}</p>
                </div>

                {/* Payment Methods */}
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-gray-600 text-sm font-medium mb-2">Payment methods</p>
                  <p className="text-gray-900">{promo.paymentMethods}</p>
                </div>

                {/* Ride Categories */}
                {promo.rideCategories && (
                  <div className="pb-4 border-b border-gray-200">
                    <p className="text-gray-600 text-sm font-medium mb-2">Ride categories</p>
                    <p className="text-gray-900">{promo.rideCategories}</p>
                  </div>
                )}

                {/* Ride Areas */}
                {promo.rideAreas && (
                  <div className="pb-4">
                    <p className="text-gray-600 text-sm font-medium mb-2">Ride areas</p>
                    <p className="text-gray-900">{promo.rideAreas}</p>
                  </div>
                )}
              </div>

              {/* Got it Button */}
              <motion.button
                onClick={onClose}
                className="w-full bg-green-600 text-white font-bold py-4 rounded-full hover:bg-green-700 transition-colors mt-8"
                whileTap={{ scale: 0.98 }}
              >
                Got it!
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
