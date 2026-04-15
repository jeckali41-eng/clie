import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapBackground } from '../components/MapBackground';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate, useLocation } from 'react-router-dom';
import { database, db } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';
import { doc, onSnapshot } from 'firebase/firestore';

interface WaitingForDriverProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  currentRideId: string | null;
  onCancel: () => void;
  onDriverFound: () => void;
}

export const WaitingForDriver: React.FC<WaitingForDriverProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  currentRideId,
  onCancel,
  onDriverFound
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [showNoDriverPopup, setShowNoDriverPopup] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const { createRide, currentRide, isLoading } = useFirebaseRide(currentRideId);
  const { profile } = useUserProfile();

  const { 
    orderType = 'ride', 
    requestId, 
    orderData = {},
    useFirestore = false // Flag to determine which DB to use
  } = location.state || {};
  
  const isFood = orderType === 'food';
  const isService = orderType === 'service';
  const isRide = orderType === 'ride';
  const orderId = requestId || currentRideId;

  const finalDestination = isService ? orderData.destinationAddress : (isFood ? orderData.destinationAddress : (orderData.destination || destination));
  const finalPickup = isService ? orderData.pickupAddress : (isFood ? orderData.pickupAddress : (orderData.pickup || pickup));
  const finalStops = isService ? (orderData.stops || []) : (isFood ? (orderData.stops || []) : (orderData.stops || stops));
  const finalCarType = isService ? orderData.vehicleClass : (isFood ? orderData.deliveryMode?.label : (orderData.rideName || carType));
  const finalPrice = isService ? orderData.pricing?.basePrice : (isFood ? orderData.totalPrice : (orderData.estimatedPrice || price));

  // Progress timer for scanning animation
  useEffect(() => {
    if (!isScanning) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsScanning(false);
          setShowNoDriverPopup(true);
          return 100;
        }
        return prev + (100 / 30);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isScanning]);

  // Listen to ride/order status changes
  useEffect(() => {
    if (!orderId) return;

    // For ride orders, check if we should use Firestore
    if (isRide && useFirestore) {
      // Listen to Firestore rides collection
      const rideDocRef = doc(db, 'rides', orderId);
      
      const unsubscribe = onSnapshot(rideDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          if (data.status === 'accepted') {
            setIsScanning(false);
            setTimeout(() => {
              navigate('/driver-coming', {
                state: {
                  orderType: 'ride',
                  requestId: orderId,
                  useFirestore: true,
                  orderData: {
                    ...orderData,
                    ...data,
                    driverId: data.driverId,
                    driverInfo: data.driverInfo
                  }
                }
              });
            }, 500);
          }
        }
      });

      return () => unsubscribe();
    } else {
      // Use Realtime Database for other order types or legacy rides
      const collectionName = isService ? 'serviceRequests' : (isFood ? 'foodOrders' : 'rides');
      const orderRef = ref(database, `${collectionName}/${orderId}`);

      const unsubscribe = onValue(orderRef, (snapshot) => {
        const data = snapshot.val();
        if (data && data.status === 'accepted') {
          setIsScanning(false);
          setTimeout(() => {
            navigate('/driver-coming', {
              state: {
                orderType,
                requestId: orderId,
                orderData: data
              }
            });
          }, 500);
        }
      });

      return () => off(orderRef, 'value', unsubscribe);
    }
  }, [orderId, orderType, isRide, useFirestore, navigate, orderData]);

  const handleRequestAgain = async () => {
    if (isLoading) return;

    setShowNoDriverPopup(false);
    setProgress(0);
    setIsScanning(true);

    // For non-food orders, we could create a new ride request
    // For now, just restart the scanning animation
  };

  const handleCancel = () => {
    setShowCancelConfirmation(true);
  };

  const handleConfirmCancel = async () => {
    try {
      if (isService) {
        localStorage.removeItem('currentServiceRequestId');
        localStorage.removeItem('currentOrderType');
      } else if (isFood) {
        localStorage.removeItem('currentFoodOrderId');
        localStorage.removeItem('currentOrderType');
      } else {
        localStorage.removeItem('currentRideId');
        localStorage.removeItem('currentOrderType');
      }

      setShowCancelConfirmation(false);
      navigate('/');
    } catch (error) {
      console.error('Error cancelling order:', error);
      setShowCancelConfirmation(false);
    }
  };

  const handleWaitForDriver = () => {
    setShowCancelConfirmation(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <MapBackground />

      <motion.div
        className="absolute top-0 left-0 right-0 z-10 p-4"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex justify-between items-center">
          <button
            onClick={handleCancel}
            className="text-red-600 font-medium text-sm hover:text-red-700"
          >
            Cancel
          </button>
          <h2 className="text-gray-800 font-bold">Finding {isService ? 'service provider' : (isFood ? 'delivery driver' : 'driver')}</h2>
          <div className="w-8" />
        </div>
      </motion.div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Searching...</span>
              <span className="text-sm font-medium text-gray-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{finalDestination}</h2>
            {finalStops.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">via {finalStops.length} stop{finalStops.length > 1 ? 's' : ''}</p>
                <div className="text-xs text-gray-500 mt-1">
                  {finalStops.map((stop: string, index: number) => (
                    <span key={index}>
                      {stop}{index < finalStops.length - 1 ? ' → ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-center space-x-4 mt-4">
              <span className="text-lg font-medium text-gray-700">{finalCarType}</span>
              <span className="text-2xl font-bold text-gray-900">R {finalPrice}</span>
            </div>
          </div>

          <AnimatePresence>
            {showNoDriverPopup && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white rounded-3xl p-6 max-w-sm w-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">⏱️</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">No drivers available</h3>
                  <p className="text-gray-600 text-center mb-8">
                    We couldn&apos;t find a driver in your area. Try again in a few moments.
                  </p>

                  <motion.button
                    onClick={handleRequestAgain}
                    className="w-full bg-green-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-green-700 mb-3"
                    whileTap={{ scale: 0.98 }}
                  >
                    Try again
                  </motion.button>
                  <motion.button
                    onClick={onCancel}
                    className="w-full bg-gray-100 text-gray-800 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200"
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCancelConfirmation && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white rounded-3xl p-6 max-w-sm w-full"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">👋</span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Cancel {isFood ? 'food order' : 'ride'}?</h3>
                  <p className="text-gray-600 text-center mb-8">
                    {isFood
                      ? 'Are you sure you want to cancel this food order?'
                      : 'Are you sure you want to cancel this ride request?'}
                  </p>

                  <motion.button
                    onClick={handleConfirmCancel}
                    className="w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-red-600 mb-3"
                    whileTap={{ scale: 0.98 }}
                  >
                    Yes, cancel
                  </motion.button>
                  <motion.button
                    onClick={handleWaitForDriver}
                    className="w-full bg-gray-100 text-gray-800 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200"
                    whileTap={{ scale: 0.98 }}
                  >
                    Keep waiting
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
