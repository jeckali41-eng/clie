import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, MessageCircle, MapPin, Star, Package, Home, Navigation } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { getETA, calculateDistance } from '../utils/etaCalculation';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface DriverData {
  name: string;
  rating: number;
  vehicleType: string;
  plateNumber: string;
  phone: string;
  photo?: string;
}

interface DriverLocation {
  lat: number;
  lng: number;
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
  driverLocation?: DriverLocation;
  destinationAddress?: string;
  destinationLocation?: { lat: number; lng: number };
  storeLocation?: { lat: number; lng: number };
  stops?: Array<{ address: string; items?: OrderItem[] }>;
  type?: string;
}

const getStatusText = (status: string, stops?: any[]): string => {
  const statusMessages: Record<string, string> = {
    driver_assigned: 'Driver is on the way to store',
    on_the_way_to_store: 'Driver is on the way to store',
    at_store: 'Driver arrived at store',
    picked_up: 'Order picked up',
    delivering: 'On the way to you',
    at_stop: stops && stops.length > 0 ? `Driver heading to stop` : 'On the way to you',
    delivered: 'Order delivered',
    completed: 'Order delivered',
  };
  return statusMessages[status] || 'Driver is on the way';
};

export const LiveTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId, orderData: initialOrderData } = location.state || {};

  const [orderData, setOrderData] = useState<OrderData>(initialOrderData || {});
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [eta, setEta] = useState<string>('Calculating...');
  const [statusText, setStatusText] = useState<string>('Driver is on the way');
  const driverListenerRef = useRef<(() => void) | null>(null);

  // Listen to order document in real-time
  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(orderRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrderData;
        setOrderData({ ...data, id: orderId });
        setStatusText(getStatusText(data.status || 'driver_assigned', data.stops));

        // Update driver location from order document
        if (data.driverLocation) {
          setDriverLocation(data.driverLocation);
        }

        // Fetch driver data if driverId exists and we don't have it yet
        if (data.driverId && !driverData) {
          try {
            const driverRef = doc(db, 'drivers', data.driverId);
            const driverSnap = await getDoc(driverRef);
            if (driverSnap.exists()) {
              setDriverData(driverSnap.data() as DriverData);
            }
          } catch (error) {
            console.error('Error fetching driver data:', error);
          }
        }

        // Handle completed status
        if (data.status === 'delivered' || data.status === 'completed') {
          setEta('Arrived');
        }
      }
    });

    return () => unsubscribe();
  }, [orderId, driverData]);

  // Listen to driver document for real-time location updates
  useEffect(() => {
    if (!orderData.driverId) return;

    const driverRef = doc(db, 'drivers', orderData.driverId);
    const unsubscribe = onSnapshot(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.location) {
          setDriverLocation({
            lat: data.location.lat || data.location.latitude,
            lng: data.location.lng || data.location.longitude,
          });
        }
        // Update driver data
        setDriverData({
          name: data.name || 'Driver',
          rating: data.rating || 0,
          vehicleType: data.vehicleType || data.carModel || 'Vehicle',
          plateNumber: data.plateNumber || 'Unknown',
          phone: data.phone || '',
          photo: data.photo,
        });
      }
    });

    driverListenerRef.current = unsubscribe;

    return () => {
      if (driverListenerRef.current) {
        driverListenerRef.current();
      }
    };
  }, [orderData.driverId]);

  // Calculate ETA based on driver location
  useEffect(() => {
    if (!driverLocation) return;

    // Determine target location based on order status
    let targetLat: number;
    let targetLng: number;

    if (orderData.status === 'on_the_way_to_store' || orderData.status === 'driver_assigned') {
      // Target is store location
      targetLat = orderData.storeLocation?.lat || -26.2041;
      targetLng = orderData.storeLocation?.lng || 28.0473;
    } else {
      // Target is destination
      targetLat = orderData.destinationLocation?.lat || -26.195;
      targetLng = orderData.destinationLocation?.lng || 28.04;
    }

    const etaString = getETA(driverLocation.lat, driverLocation.lng, targetLat, targetLng);
    setEta(etaString);
  }, [driverLocation, orderData.status, orderData.storeLocation, orderData.destinationLocation]);

  const handleCall = () => {
    if (driverData?.phone) {
      window.location.href = `tel:${driverData.phone}`;
    }
  };

  const handleMessage = () => {
    // Navigate to message panel or open messaging
    console.log('Open messaging');
  };

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* Map Placeholder Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-green-50 to-blue-50">
        {/* Map placeholder with roads pattern */}
        <div className="absolute inset-0 opacity-40">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="map-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#d1d5db" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
          </svg>
        </div>

        {/* Simulated roads */}
        <div className="absolute inset-0">
          <div className="absolute top-[30%] left-0 right-0 h-4 bg-amber-200/60 transform -rotate-3" />
          <div className="absolute top-[50%] left-0 right-0 h-3 bg-amber-200/50 transform rotate-2" />
          <div className="absolute top-[70%] left-0 right-0 h-4 bg-amber-200/60 transform -rotate-1" />
          <div className="absolute top-0 bottom-0 left-[25%] w-3 bg-amber-200/50 transform rotate-2" />
          <div className="absolute top-0 bottom-0 left-[60%] w-4 bg-amber-200/60 transform -rotate-1" />
          {/* River/water feature */}
          <div className="absolute top-[40%] left-[40%] w-32 h-64 bg-blue-200/40 rounded-full transform rotate-45" />
        </div>

        {/* Store Location Marker */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="absolute top-[35%] left-[20%] transform -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <Package size={24} className="text-white" />
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-red-500" />
          </div>
        </motion.div>

        {/* Driver Location Marker (Car) */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="absolute top-[50%] left-[45%] transform -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="relative"
          >
            <div className="w-14 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center">
              <span className="text-2xl">🚗</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Destination Location Marker (Home) */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
          className="absolute top-[55%] right-[15%] transform translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
              <Home size={24} className="text-white" />
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-green-500" />
          </div>
        </motion.div>

        {/* Route line placeholder */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            d="M 20% 35% Q 35% 45%, 45% 50% T 85% 55%"
            fill="none"
            stroke="#22c55e"
            strokeWidth="4"
            strokeDasharray="8 8"
            className="opacity-60"
          />
        </svg>
      </div>

      {/* Top Status Panel */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-4 left-4 right-4 z-20"
      >
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <motion.h2
            key={statusText}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-bold text-gray-900"
          >
            {statusText}
          </motion.h2>
          <motion.p
            key={eta}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-600 mt-1"
          >
            Arriving in <span className="font-semibold text-green-600">{eta}</span>
          </motion.p>
        </div>
      </motion.div>

      {/* Bottom Panel */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20"
      >
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Driver Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              {/* Driver Photo */}
              <div className="relative">
                {driverData?.photo ? (
                  <img
                    src={driverData.photo}
                    alt={driverData.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                    {driverData?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>

              {/* Driver Info */}
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-lg text-gray-900">{driverData?.name || 'Driver'}</h3>
                  <div className="flex items-center space-x-1 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      {driverData?.rating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">{driverData?.vehicleType || 'Vehicle'}</p>
                <p className="text-gray-900 font-medium text-sm bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">
                  {driverData?.plateNumber || 'Unknown'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={handleCall}
                className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors"
              >
                <Phone size={20} className="text-white" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={handleMessage}
                className="w-11 h-11 bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-900 transition-colors"
              >
                <MessageCircle size={20} className="text-white" />
              </motion.button>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Package size={16} className="text-gray-500" />
                <span className="text-gray-600">
                  {orderData.items?.length || 0} Item{(orderData.items?.length || 0) !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-bold text-gray-900">R {orderData.total?.toFixed(2) || '0.00'}</span>
            </div>
          </motion.div>

          {/* Delivery Address */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-start space-x-3 bg-gray-50 rounded-xl p-3"
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery Address</p>
              <p className="text-gray-900 text-sm mt-1">
                {orderData.destinationAddress || 'Address not specified'}
              </p>
            </div>
          </motion.div>

          {/* Stops if any */}
          {orderData.stops && orderData.stops.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-2"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery Stops</p>
              {orderData.stops.map((stop, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 bg-orange-50 rounded-xl p-3"
                >
                  <div className="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-orange-700">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 text-sm">{stop.address || String(stop)}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
