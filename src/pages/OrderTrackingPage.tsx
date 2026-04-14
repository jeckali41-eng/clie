import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MapPin, Store, Package, Truck, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface OrderItem {
  name: string;
  quantity?: number;
  price: number;
  image?: string;
}

interface OrderData {
  id?: string;
  storeName?: string;
  storeAddress?: string;
  items?: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  status?: string;
  driverStatus?: string;
  driverId?: string | null;
  destinationAddress?: string;
  stops?: Array<{ address: string; items?: OrderItem[] }>;
  type?: string;
}

// Status steps for the UI timeline
// Note: "Preparing Items" is a UI-only stage that appears when status = "accepted"
const statusSteps: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'accepted', label: 'Order Accepted', icon: Check },
  { key: 'preparing', label: 'Preparing Items', icon: Package },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', icon: Package },
  { key: 'searching', label: 'Assigning Driver', icon: Truck },
  { key: 'driver_assigned', label: 'Driver Assigned', icon: User },
];

// Rotating status messages for different stages
const preparingMessages = [
  "Preparing your order...",
  "Packing everything carefully...",
  "Almost ready...",
];

const searchingMessages = [
  "Looking for nearby drivers...",
  "Finding the fastest rider...",
  "Connecting to a delivery partner...",
];

// Determine which steps are completed based on Firestore status and driverStatus
const getCompletedSteps = (
  status: string,
  driverStatus: string,
  preparingShown: boolean
): { completed: boolean; current: boolean }[] => {
  const steps = [
    { completed: false, current: false }, // Order Accepted
    { completed: false, current: false }, // Preparing Items
    { completed: false, current: false }, // Ready for Pickup
    { completed: false, current: false }, // Assigning Driver
    { completed: false, current: false }, // Driver Assigned
  ];

  // Status: accepted -> Mark "Order Accepted" complete, "Preparing Items" becomes current (after delay)
  if (status === 'accepted') {
    steps[0] = { completed: true, current: false }; // Order Accepted
    steps[1] = { completed: preparingShown, current: !preparingShown }; // Preparing Items
    return steps;
  }

  // Status: ready_for_pickup -> Mark first 3 steps complete
  if (status === 'ready_for_pickup') {
    steps[0] = { completed: true, current: false }; // Order Accepted
    steps[1] = { completed: true, current: false }; // Preparing Items
    steps[2] = { completed: true, current: false }; // Ready for Pickup

    // Check if driver search has started
    if (driverStatus === 'searching') {
      steps[3] = { completed: false, current: true }; // Assigning Driver (current)
    } else if (driverStatus === 'assigned') {
      steps[3] = { completed: true, current: false }; // Assigning Driver (done)
      steps[4] = { completed: true, current: false }; // Driver Assigned
    }
    return steps;
  }

  // Status: driver_assigned -> All steps complete
  if (status === 'driver_assigned') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: true, current: false };
    steps[4] = { completed: true, current: false };
    return steps;
  }

  // Also check driverStatus independently for driver assignment
  if (driverStatus === 'assigned') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: true, current: false };
    steps[4] = { completed: true, current: false };
    return steps;
  }

  if (driverStatus === 'searching') {
    steps[0] = { completed: true, current: false };
    steps[1] = { completed: true, current: false };
    steps[2] = { completed: true, current: false };
    steps[3] = { completed: false, current: true }; // Assigning Driver (current)
    return steps;
  }

  // Default: waiting for order to be accepted
  return steps;
};

export const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderData: initialOrderData } = location.state || {};

  const [orderData, setOrderData] = useState<OrderData>(initialOrderData || {});
  const [preparingShown, setPreparingShown] = useState(false);
  const [rotatingMessage, setRotatingMessage] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  
  // Refs for timeouts
  const preparingDelayRef = useRef<NodeJS.Timeout | null>(null);
  const transitionDelayRef = useRef<NodeJS.Timeout | null>(null);
  const messageRotationRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate step states based on current Firestore data
  const stepStates = getCompletedSteps(
    orderData.status || '',
    orderData.driverStatus || '',
    preparingShown
  );

  // Determine current stage for rotating messages
  const currentStage = orderData.driverStatus === 'searching' 
    ? 'searching' 
    : (orderData.status === 'accepted' && !preparingShown) 
      ? 'preparing' 
      : orderData.status === 'accepted' 
        ? 'preparing' 
        : null;

  // Listen to Firestore order document in real-time
  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;
        setOrderData({ ...data, id: orderId });
      }
    });

    return () => unsubscribe();
  }, [orderId]);

  // Handle "Preparing Items" delay when status becomes "accepted"
  useEffect(() => {
    if (orderData.status === 'accepted' && !preparingShown) {
      // Clear any existing timeout
      if (preparingDelayRef.current) {
        clearTimeout(preparingDelayRef.current);
      }
      // After 5 seconds, mark "Preparing Items" as active
      preparingDelayRef.current = setTimeout(() => {
        setPreparingShown(true);
      }, 5000);
    }

    return () => {
      if (preparingDelayRef.current) {
        clearTimeout(preparingDelayRef.current);
      }
    };
  }, [orderData.status, preparingShown]);

  // Handle transition to LiveTrackingPage when driverStatus becomes "searching"
  useEffect(() => {
    if (orderData.driverStatus === 'searching') {
      // Clear any existing timeout
      if (transitionDelayRef.current) {
        clearTimeout(transitionDelayRef.current);
      }
      // After 3 seconds, transition to live tracking
      transitionDelayRef.current = setTimeout(() => {
        navigate('/live-tracking', {
          state: {
            orderId,
            orderData: { ...orderData, id: orderId },
          },
          replace: true,
        });
      }, 3000);
    }

    // Also transition immediately if driver is assigned
    if (orderData.status === 'driver_assigned' || orderData.driverStatus === 'assigned' || orderData.driverId) {
      if (transitionDelayRef.current) {
        clearTimeout(transitionDelayRef.current);
      }
      transitionDelayRef.current = setTimeout(() => {
        navigate('/live-tracking', {
          state: {
            orderId,
            orderData: { ...orderData, id: orderId },
          },
          replace: true,
        });
      }, 1500);
    }

    return () => {
      if (transitionDelayRef.current) {
        clearTimeout(transitionDelayRef.current);
      }
    };
  }, [orderData.driverStatus, orderData.status, orderData.driverId, orderId, navigate, orderData]);

  // Rotate status messages every 3-4 seconds
  useEffect(() => {
    const messages = currentStage === 'searching' ? searchingMessages : preparingMessages;
    
    if (currentStage) {
      setRotatingMessage(messages[0]);
      
      messageRotationRef.current = setInterval(() => {
        setMessageIndex((prev) => {
          const nextIndex = (prev + 1) % messages.length;
          setRotatingMessage(messages[nextIndex]);
          return nextIndex;
        });
      }, 3500);
    }

    return () => {
      if (messageRotationRef.current) {
        clearInterval(messageRotationRef.current);
      }
    };
  }, [currentStage]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      {/* FIXED TOP PANEL - Store info */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-shrink-0 bg-white shadow-md px-4 py-4 z-20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{orderData.storeName || 'Store'}</h1>
            <p className="text-xs text-gray-500">#{orderId?.slice(-4).toUpperCase() || 'Order'}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">
              R {orderData.total?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* STATIC STATUS TIMELINE - Center of screen, no scroll */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-4 w-full max-w-md"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-0">
            {statusSteps.map((step, index) => {
              const { completed: isCompleted, current: isCurrent } = stepStates[index];
              const Icon = step.icon;

              return (
                <motion.div key={step.key} variants={itemVariants} className="relative">
                  <div className="flex items-start">
                    {/* Timeline Line with animated fill */}
                    {index < statusSteps.length - 1 && (
                      <div className="absolute left-[15px] top-[28px] w-0.5 h-8 bg-gray-200">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="bg-green-500 w-full"
                        />
                      </div>
                    )}

                    {/* Icon Circle with animations */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.5 }}
                      animate={
                        isCurrent 
                          ? { 
                              scale: [1, 1.15, 1], 
                              opacity: 1,
                              boxShadow: ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 8px rgba(34, 197, 94, 0)', '0 0 0 0 rgba(34, 197, 94, 0.4)']
                            } 
                          : { scale: 1, opacity: 1 }
                      }
                      transition={isCurrent ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : { duration: 0.3 }}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-green-500 text-white ring-4 ring-green-100'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        >
                          <Check size={16} />
                        </motion.div>
                      ) : (
                        <Icon size={16} />
                      )}
                    </motion.div>

                    {/* Label with bold animation */}
                    <div className="ml-3 pb-6">
                      <motion.p
                        animate={{ 
                          fontWeight: isCurrent ? 700 : isCompleted ? 500 : 400,
                          color: isCompleted || isCurrent ? '#111827' : '#9ca3af'
                        }}
                        transition={{ duration: 0.3 }}
                        className="text-sm"
                      >
                        {step.label}
                      </motion.p>
                      
                      {/* Pulsing indicator and rotating message for current step */}
                      {isCurrent && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center mt-1 space-x-2"
                        >
                          {/* Pulsing dot */}
                          <motion.div
                            animate={{ 
                              scale: [1, 1.3, 1],
                              opacity: [0.7, 1, 0.7]
                            }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                            className="w-2 h-2 bg-green-500 rounded-full"
                          />
                          
                          {/* Loading dots for searching */}
                          {step.key === 'searching' && (
                            <div className="flex space-x-1">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  animate={{ 
                                    y: [0, -4, 0],
                                    opacity: [0.5, 1, 0.5]
                                  }}
                                  transition={{ 
                                    repeat: Infinity, 
                                    duration: 0.8, 
                                    delay: i * 0.15,
                                    ease: 'easeInOut'
                                  }}
                                  className="w-1.5 h-1.5 bg-green-500 rounded-full"
                                />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Rotating status message */}
          <AnimatePresence mode="wait">
            {rotatingMessage && (
              <motion.div
                key={rotatingMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-4 text-center"
              >
                <p className="text-sm text-gray-600 italic">{rotatingMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* FIXED BOTTOM PANELS */}
      <div className="flex-shrink-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
        {/* Order Summary Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-4 pt-4 pb-2 border-b border-gray-100"
        >
          <h2 className="font-bold text-gray-900 text-sm mb-2">Order Summary</h2>
          
          {/* Scrollable items list - only this scrolls */}
          <div className="max-h-32 overflow-y-auto">
            {orderData.items && orderData.items.length > 0 ? (
              <div className="space-y-2">
                {orderData.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center space-x-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package size={16} className="text-gray-400" />
                        </div>
                      )}
                      <p className="text-sm text-gray-900">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">x{item.quantity || 1}</p>
                      <p className="text-sm font-medium text-gray-900">R {(item.price * (item.quantity || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">No items in order</p>
            )}
          </div>

          {/* Totals - always visible */}
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">R {orderData.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Delivery Fee</span>
              <span className="text-gray-900">R {orderData.deliveryFee?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-100">
              <span className="text-gray-900">Total</span>
              <span className="text-gray-900">R {orderData.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </motion.div>

        {/* Delivery Address Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-4 py-3"
        >
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">Delivery to</p>
              <p className="text-gray-600 text-xs truncate">{orderData.destinationAddress || 'Address not specified'}</p>
            </div>
          </div>

          {/* Multiple Stops */}
          {orderData.stops && orderData.stops.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="font-medium text-gray-900 text-xs mb-2">Delivery Stops</p>
              {orderData.stops.map((stop, index) => (
                <div key={index} className="flex items-start space-x-2 mb-1 last:mb-0">
                  <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-orange-600">{index + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{typeof stop === 'string' ? stop : stop.address}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
