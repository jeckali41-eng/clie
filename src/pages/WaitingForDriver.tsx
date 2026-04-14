import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, X, Plus, MapPin } from 'lucide-react';
import { BottomNavigation } from '../components/BottomNavigation';
import { DraggablePanel } from '../components/DraggablePanel';
import { ScrollableSection } from '../components/ScrollableSection';
import { MapBackground } from '../components/MapBackground';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useUserProfile } from '../hooks/useUserProfile';
import { calculatePriceWithStops, getCarTypePrice } from '../utils/priceCalculation';
import { useNavigate, useLocation } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import { database } from '../config/firebase';
import { ref, onValue, off } from 'firebase/database';

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

  const { orderType = 'ride', requestId, orderData = {} } = location.state || {};
  const isFood = orderType === 'food';
  const isService = orderType === 'service';
  const collectionName = isService ? 'serviceRequests' : (isFood ? 'foodOrders' : 'rides');
  const orderId = requestId || currentRideId;

  const finalDestination = isService ? orderData.destinationAddress : (isFood ? orderData.destinationAddress : destination);
  const finalPickup = isService ? orderData.pickupAddress : (isFood ? orderData.pickupAddress : pickup);
  const finalStops = isService ? (orderData.stops || []) : (isFood ? (orderData.stops || []) : stops);
  const finalCarType = isService ? orderData.vehicleClass : (isFood ? orderData.deliveryMode?.label : carType);
  const finalPrice = isService ? orderData.pricing?.basePrice : (isFood ? orderData.totalPrice : price);

  const priceCalculation = !isFood && !isService ? calculatePriceWithStops(pickup, destination, stops) : null;
  const displayPrice = isService || isFood ? finalPrice : (priceCalculation ? getCarTypePrice(priceCalculation.totalPrice, carType) : finalPrice);

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

  useEffect(() => {
    if (!orderId) return;

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
        }, 1000);
      }
    });

    return () => off(orderRef, 'value', unsubscribe);
  }, [orderId, collectionName, orderType, navigate]);

  const handleRequestAgain = async () => {
    if (isLoading) return;

    setShowNoDriverPopup(false);
    setProgress(0);
    setIsScanning(true);

    if (!isFood) {
      const rideRequest = {
        destination: finalDestination,
        pickup: finalPickup,
        stops: finalStops || [],
        carType: finalCarType,
        price: displayPrice,
        status: 'pending' as const,
        userId: profile?.id || 'user123',
        userName: profile?.name || 'Unknown User',
      };

      try {
        const rideId = await createRide(rideRequest);
      } catch (error) {
        console.error('Failed to request again:', error);
        setShowNoDriverPopup(true);
      }
    }
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
                  {finalStops.map((stop, index) => (
                    <span key={index}>
                      {stop}{index < finalStops.length - 1 ? ' → ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-center space-x-4 mt-4">
              <span className="text-lg font-medium text-gray-700">{finalCarType}</span>
              <span className="text-2xl font-bold text-gray-900">R {displayPrice}</span>
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
                    We couldn't find a driver in your area. Try again in a few moments.
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
