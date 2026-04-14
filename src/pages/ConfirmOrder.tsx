import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { MapBackground } from '../components/MapBackground';
import { useFirebaseRide } from '../hooks/useFirebaseRide';
import { useUserProfile } from '../hooks/useUserProfile';
import { calculatePriceWithStops, getCarTypePrice } from '../utils/priceCalculation';
import { useRideContext } from '../contexts/RideContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { database, auth, db } from '../config/firebase';
import { ref, push, set } from 'firebase/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface UserLocation {
  lat: number | null;
  lng: number | null;
}

interface ConfirmOrderProps {
  destination: string;
  pickup: string;
  stops: string[];
  carType: string;
  price: number;
  onBack: () => void;
  onRideConfirmed: () => void;
  onRideCreated: (rideId: string) => void;
}

export const ConfirmOrder: React.FC<ConfirmOrderProps> = ({
  destination,
  pickup,
  stops,
  carType,
  price,
  onBack,
  onRideConfirmed,
  onRideCreated,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation>({ lat: null, lng: null });
  const { profile } = useUserProfile();
  const { createRide } = useFirebaseRide();
  const { isRideActive } = useRideContext();

  // Get user's GPS location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
          // Keep null values if GPS fails
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const {
    orderType = 'ride',
    type = '', // Category type: 'food', 'clothes', 'hardware'
    orderData = {},
    serviceType,
    vehicle,
    extraSelection,
    pickupAddress,
    destinationAddress
  } = location.state || {};

  const isDelivery = orderType === 'delivery';
  const isFood = orderType === 'food'; // Legacy support

  const isDeliveryOrFood = isDelivery || isFood;
  const finalDestination = isDeliveryOrFood ? orderData.destinationAddress : destination;
  const finalPickup = isDeliveryOrFood ? (orderData.storeAddress || orderData.pickupAddress) : pickup;
  const finalStops = isDeliveryOrFood ? (orderData.stops || []) : stops;
  const finalCarType = isDeliveryOrFood ? orderData.deliveryMode?.label : carType;
  const finalPrice = isDeliveryOrFood ? orderData.totalPrice : price;

  const priceCalculation = !isDeliveryOrFood ? calculatePriceWithStops(pickup, destination, stops) : null;
  const displayPrice = isDeliveryOrFood ? finalPrice : (priceCalculation ? getCarTypePrice(priceCalculation.totalPrice, carType) : finalPrice);

  const isService = serviceType && serviceType !== 'ride';

  const getServiceLabel = () => {
    if (serviceType === 'package') return 'Package Delivery';
    if (serviceType === 'towing') return 'Towing Service';
    if (serviceType === 'truck') return 'Truck Service';
    return '';
  };

  const getExtraSelectionLabel = () => {
    if (serviceType === 'package') return 'Weight';
    if (serviceType === 'towing') return 'Vehicle Type';
    if (serviceType === 'truck') return 'Cargo Type';
    return '';
  };

  const buildServiceRequest = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to request a service');
    }

    return {
      type: serviceType,
      vehicleClass: vehicle?.name || '',
      serviceMeta: {
        [getExtraSelectionLabel().toLowerCase().replace(' ', '_')]: extraSelection || ''
      },
      pickupAddress: pickupAddress || '',
      destinationAddress: destinationAddress || '',
      stops: stops || [],
      status: 'pending',
      timestamp: Date.now(),
      userId: currentUser.uid,
      userName: currentUser.displayName || profile?.name || 'Unknown User',
      userEmail: currentUser.email || profile?.email || '',
      pricing: {
        basePrice: vehicle?.price || 0,
        currency: 'ZAR'
      }
    };
  };

  const confirmServiceRequest = async () => {
    try {
      const serviceRequest = buildServiceRequest();
      const serviceRequestsRef = ref(database, 'serviceRequests');
      const newServiceRequestRef = push(serviceRequestsRef);
      const serviceRequestId = newServiceRequestRef.key!;

      await set(newServiceRequestRef, serviceRequest);

      localStorage.setItem('currentServiceRequestId', serviceRequestId);
      localStorage.setItem('currentOrderType', 'service');

      navigate('/waiting-for-driver', {
        state: {
          orderType: 'service',
          requestId: serviceRequestId,
          orderData: serviceRequest
        }
      });
    } catch (error) {
      console.error('Failed to create service request:', error);
      throw error;
    }
  };

  const createDeliveryOrder = async () => {
    const currentUser = auth.currentUser;
    // Guest checkout is allowed per Firestore rules (allow create: if true)

    // Clean items array - only include required fields
    const cleanItems = (orderData.items || []).map((item: any) => ({
      id: item.id || '',
      name: item.name || '',
      price: item.price || 0,
      image: item.image || '',
      category: type || item.category || 'food',
    }));

    // Build the exact Firestore document structure
    const deliveryOrder = {
      // Order type
      type: type || 'food', // "food" | "clothes" | "hardware"

      // Store info
      storeId: orderData.storeId || '',
      storeName: orderData.storeName || '',
      storeAddress: orderData.storeAddress || '', // Real store address from Firestore
      storeLocation: orderData.storeLocation || { lat: null, lng: null },

      // User info
      userId: currentUser?.uid || 'guest',
      userName: currentUser?.displayName || profile?.name || 'Guest User',
      userEmail: currentUser?.email || profile?.email || '',

      // User location from GPS (NOT extracted from address string)
      userLocation: {
        lat: userLocation.lat,
        lng: userLocation.lng,
      },
      destinationAddress: orderData.destinationAddress || '',

      // Items
      items: cleanItems,

      // Pricing
      subtotal: orderData.subtotal || orderData.foodSubtotal || 0,
      deliveryFee: orderData.deliveryFee || 0,
      total: orderData.totalPrice || 0,

      // Delivery mode
      deliveryMode: orderData.deliveryMode ? {
        id: orderData.deliveryMode.id || '',
        fee: orderData.deliveryMode.deliveryFee || orderData.deliveryFee || 0,
        estimatedTime: parseInt(orderData.deliveryMode.time) || 20,
      } : null,

      // Status
      status: 'pending',
      driverId: null,
      driverStatus: 'waiting',

      // Prep time
      prepTime: 15,

      // Timestamp
      createdAt: serverTimestamp(),
    };

    // Save to Firestore 'orders' collection
    const ordersRef = collection(db, 'orders');
    const docRef = await addDoc(ordersRef, deliveryOrder);
    const orderId = docRef.id;

    localStorage.setItem('currentDeliveryOrderId', orderId);
    localStorage.setItem('currentOrderType', 'delivery');

    // Navigate to OrderTrackingPage for delivery orders (food, clothes, hardware)
    navigate('/order-tracking', {
      state: {
        orderId: orderId,
        orderData: {
          ...deliveryOrder,
          id: orderId,
        }
      }
    });

    return orderId;
  };

  const handleConfirmOrder = async () => {
    if (isLoading || isRideActive) {
      if (isRideActive) {
        alert('You already have an active order.');
      }
      return;
    }

    setIsLoading(true);

    try {
      if (isService) {
        await confirmServiceRequest();
      } else if (isDelivery) {
        // Use the new createDeliveryOrder for all delivery types (food, clothes, hardware)
        await createDeliveryOrder();
      } else if (isFood) {
        // Legacy food order support - redirect to new delivery flow
        const foodOrder = {
          type: 'food',
          deliveryMode: orderData.deliveryMode,
          pickupAddress: orderData.pickupAddress,
          destinationAddress: orderData.destinationAddress,
          stops: orderData.stops || [],
          items: orderData.items || [],
          foodSubtotal: orderData.foodSubtotal,
          deliveryFee: orderData.deliveryFee,
          totalPrice: orderData.totalPrice,
          status: 'pending',
          timestamp: Date.now(),
          userId: profile?.id || 'user123',
          userName: profile?.name || 'Unknown User'
        };

        const foodOrdersRef = ref(database, 'foodOrders');
        const newFoodOrderRef = push(foodOrdersRef);
        const foodOrderId = newFoodOrderRef.key!;

        await set(newFoodOrderRef, foodOrder);

        localStorage.setItem('currentFoodOrderId', foodOrderId);
        localStorage.setItem('currentOrderType', 'food');

        navigate('/waiting-for-driver', {
          state: {
            orderType: 'food',
            requestId: foodOrderId,
            orderData: foodOrder
          }
        });
      } else {
        const rideRequest = {
          pickup: finalPickup,
          destination: finalDestination,
          stops: finalStops || [],
          carType: finalCarType,
          price: displayPrice,
          status: 'pending' as const,
          userId: profile?.id || 'user123',
          userName: profile?.name || 'Unknown User'
        };

        const rideId = await createRide(rideRequest);

        onRideCreated(rideId);

        navigate('/waiting-for-driver', {
          state: {
            orderType: 'ride',
            requestId: rideId,
            orderData: rideRequest
          }
        });
      }
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <MapBackground />

      <AnimatePresence>
        {!isLoading && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 p-4"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-800" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute top-24 left-1/2 transform -translate-x-1/2 z-10"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">2</div>
            <div className="text-sm">min</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-20 max-h-[80vh] overflow-y-auto"
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
      >
        <div className="space-y-6">
          {isService ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{getServiceLabel()}</h2>
                <p className="text-gray-600">{vehicle?.description}</p>
                <p className="text-sm text-gray-500">{vehicle?.eta}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pickup:</span>
                    <span className="text-gray-900 font-medium">{pickupAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Destination:</span>
                    <span className="text-gray-900 font-medium">{destinationAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehicle:</span>
                    <span className="text-gray-900 font-medium">{vehicle?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{getExtraSelectionLabel()}:</span>
                    <span className="text-gray-900 font-medium">{extraSelection}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Pricing</h3>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {vehicle?.price || 0}</span>
                </div>
              </div>
            </>
          ) : isDelivery ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{orderData.deliveryMode?.label}</h2>
                <p className="text-gray-600">{orderData.deliveryMode?.description}</p>
                <p className="text-sm text-gray-500">{orderData.deliveryMode?.time}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="text-gray-900 font-medium text-right max-w-[200px] truncate">
                      {orderData.storeAddress || orderData.storeName || 'Store'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="text-gray-900 font-medium text-right max-w-[200px] truncate">
                      {orderData.destinationAddress}
                    </span>
                  </div>
                  {orderData.stops && orderData.stops.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stops:</span>
                      <span className="text-gray-900 font-medium">{orderData.stops.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {orderData.items && orderData.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Items ({orderData.items.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="font-medium text-gray-900">R {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">R {orderData.subtotal || orderData.foodSubtotal || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fee</span>
                  <span className="font-medium text-gray-900">R {orderData.deliveryFee}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {orderData.totalPrice}</span>
                </div>
              </div>
            </>
          ) : isFood ? (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{orderData.deliveryMode?.label}</h2>
                <p className="text-gray-600">{orderData.deliveryMode?.description}</p>
                <p className="text-sm text-gray-500">{orderData.deliveryMode?.time}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Delivery Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="text-gray-900 font-medium">{orderData.pickupAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="text-gray-900 font-medium">{orderData.destinationAddress}</span>
                  </div>
                  {orderData.stops && orderData.stops.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stops:</span>
                      <span className="text-gray-900 font-medium">{orderData.stops.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {orderData.items && orderData.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Food Items</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {orderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="font-medium text-gray-900">R {item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Summary</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Food subtotal</span>
                  <span className="font-medium text-gray-900">R {orderData.foodSubtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fee</span>
                  <span className="font-medium text-gray-900">R {orderData.deliveryFee}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R {orderData.totalPrice}</span>
                </div>
              </div>
            </>
          ) : (
            <>
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
                {priceCalculation && (
                  <div className="text-sm text-gray-500 mt-2">
                    {priceCalculation.totalDistance}km total distance
                  </div>
                )}
              </div>
            </>
          )}

          <motion.button
            onClick={handleConfirmOrder}
            disabled={isLoading || isRideActive}
            className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-colors
              ${isLoading || isRideActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: isLoading || isRideActive ? 1 : 1.02 }}
          >
            {isLoading ? 'Processing...' : isRideActive ? 'Order Active' : 'Confirm order'}
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 text-center text-sm mt-2">
              You have an active order
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
