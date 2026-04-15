import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { X, Plus, Calendar, Users, User, Briefcase, ChevronDown } from 'lucide-react';
import { MapBackground } from '../components/MapBackground';
import { PromoDetailsPanel } from '../components/PromoDetailsPanel';
import { useRideContext } from '../contexts/RideContext';
import { useRideOptions } from '../hooks/useRideOptions';
import { RideOption } from '../services/rideService';
import { getFleetOptions, FleetVehicle } from '../services/fleetService';

// Car icons mapping - use public folder images with emoji fallbacks
const RIDE_ICONS: Record<string, { image?: string; emoji: string; color: string }> = {
  'ride_economy': { image: '/cars/economy.png', emoji: '🚙', color: 'bg-green-100' },
  'ride_comfort': { image: '/cars/comfort.png', emoji: '🚗', color: 'bg-gray-100' },
  'ride_xl': { image: '/cars/xl.png', emoji: '🚐', color: 'bg-blue-100' },
  'ride_women': { image: '/cars/economy.png', emoji: '🚗', color: 'bg-pink-100' },
  'aletwende': { image: '/cars/economy.png', emoji: '🚕', color: 'bg-yellow-100' },
};

interface SelectRideProps {
  destination: string;
  pickup: string;
  stops: string[];
  onBack: () => void;
  onSelectRide: (carType: string, price: number) => void;
}

type FilterTab = 'recommended' | 'faster' | 'cheaper';

const PANEL_MIN_VH = 36;
const PANEL_MAX_VH = 85;
const EXPAND_THRESHOLD_VH = 55;

export const SelectRide: React.FC<SelectRideProps> = ({
  destination,
  pickup,
  stops,
  onBack,
  onSelectRide
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isRideActive } = useRideContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Read navigation state to determine service type
  const { 
    serviceType = 'ride', 
    extraOption,
    pickupCoords,
    destinationCoords 
  } = location.state || {};

  // User's GPS location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user's GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
          // Default to Johannesburg coordinates
          setUserLocation({ lat: -26.2041, lng: 28.0473 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      // Default to Johannesburg coordinates
      setUserLocation({ lat: -26.2041, lng: 28.0473 });
    }
  }, []);

  // Promo discount (30%)
  const promoDiscount = 30;

  // Use the real-time ride options hook for "ride" service type
  const { 
    rideOptions, 
    isLoading: isLoadingRides, 
    error: rideError 
  } = useRideOptions({
    pickupLat: pickupCoords?.lat || userLocation?.lat || null,
    pickupLng: pickupCoords?.lng || userLocation?.lng || null,
    destinationLat: destinationCoords?.lat || null,
    destinationLng: destinationCoords?.lng || null,
    discountPercent: promoDiscount,
    enabled: serviceType === 'ride'
  });

  // State for fleet vehicles (non-ride services)
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);

  // Selected ride option
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [selectedFleetVehicle, setSelectedFleetVehicle] = useState<FleetVehicle | null>(null);
  
  const [showPromoDetails, setShowPromoDetails] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('recommended');
  const [profileToggle, setProfileToggle] = useState<'personal' | 'business'>('personal');

  // Spring-driven panel height (in vh)
  const rawPanelVh = useMotionValue(PANEL_MIN_VH);
  const springPanelVh = useSpring(rawPanelVh, {
    stiffness: 300,
    damping: 35,
    mass: 0.8,
  });
  const panelHeightStyle = useTransform(springPanelVh, (v) => `${v}vh`);

  const [isExpanded, setIsExpanded] = useState(false);

  // Track expansion state from spring value
  useEffect(() => {
    const unsubscribe = springPanelVh.on('change', (latest) => {
      setIsExpanded(latest > EXPAND_THRESHOLD_VH);
    });
    return unsubscribe;
  }, [springPanelVh]);

  // Select first available ride option when options load
  useEffect(() => {
    if (serviceType === 'ride' && rideOptions.length > 0 && !selectedRide) {
      // Select first available option
      const firstAvailable = rideOptions.find(opt => opt.isAvailable) || rideOptions[0];
      setSelectedRide(firstAvailable);
    }
  }, [rideOptions, selectedRide, serviceType]);

  // Load fleet options for logistics services
  useEffect(() => {
    async function loadFleet() {
      if (serviceType !== 'ride') {
        setIsLoadingFleet(true);
        try {
          const vehicles = await getFleetOptions(serviceType as any, extraOption);
          setFleetVehicles(vehicles);
          if (vehicles.length > 0) {
            setSelectedFleetVehicle(vehicles[0]);
          }
        } catch (error) {
          console.error('Failed to load fleet:', error);
        } finally {
          setIsLoadingFleet(false);
        }
      }
    }

    loadFleet();
  }, [serviceType, extraOption]);

  const promo = {
    discount: promoDiscount,
    ridesLeft: 5,
    maxPerRide: 80,
    expiryDate: 'December 29, 2025',
    paymentMethods: 'Apple Pay, Bolt balance, Google Pay, Card, Family, Cash',
    rideCategories: 'XL, Women for Women, Economy, Bolt, Comfort, Lite, Premium, XXL, Send, Business Send (excludes Scheduled Rides)',
    rideAreas: 'Gauteng'
  };

  const handleDrag = useCallback((_event: any, info: PanInfo) => {
    const windowHeight = window.innerHeight;
    const deltaVh = (-info.delta.y / windowHeight) * 100;
    const newVh = rawPanelVh.get() + deltaVh;
    rawPanelVh.set(Math.max(PANEL_MIN_VH, Math.min(PANEL_MAX_VH, newVh)));
  }, [rawPanelVh]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((_event: any, info: PanInfo) => {
    setIsDragging(false);
    const velocity = -info.velocity.y;

    if (Math.abs(velocity) > 600) {
      rawPanelVh.set(velocity > 0 ? PANEL_MAX_VH : PANEL_MIN_VH);
    } else {
      const currentVh = rawPanelVh.get();
      if (currentVh > EXPAND_THRESHOLD_VH) {
        rawPanelVh.set(PANEL_MAX_VH);
      } else {
        rawPanelVh.set(PANEL_MIN_VH);
      }
    }
  }, [rawPanelVh]);

  // Sort ride options based on filter
  const getSortedRideOptions = (): RideOption[] => {
    let sorted = [...rideOptions];

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => {
        // Available rides first
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.etaMinutes - b.etaMinutes;
      });
    } else if (selectedFilter === 'cheaper') {
      sorted.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.estimatedPrice - b.estimatedPrice;
      });
    }

    return sorted;
  };

  const sortedRideOptions = getSortedRideOptions();

  // Sort fleet vehicles
  const getSortedFleetVehicles = (): FleetVehicle[] => {
    let sorted = [...fleetVehicles];

    if (selectedFilter === 'faster') {
      sorted.sort((a, b) => {
        const aTime = parseInt(a.eta) || 0;
        const bTime = parseInt(b.eta) || 0;
        return aTime - bTime;
      });
    } else if (selectedFilter === 'cheaper') {
      sorted.sort((a, b) => a.price - b.price);
    }

    return sorted;
  };

  const sortedFleetVehicles = getSortedFleetVehicles();

  const getAddressDisplay = () => {
    const stopsText = stops.length > 0 ? ` +${stops.length} stop${stops.length > 1 ? 's' : ''}` : '';
    return `${pickup} → ${destination}${stopsText}`;
  };

  // Handle ride selection and navigation to confirm
  const handleSelectRide = () => {
    if (isRideActive) {
      alert('You already have an active ride.');
      return;
    }

    if (serviceType === 'ride' && selectedRide) {
      // Navigate to confirm order with all ride data
      navigate('/confirm-order', {
        state: {
          orderType: 'ride',
          rideData: {
            pricingId: selectedRide.pricingId,
            name: selectedRide.displayName,
            estimatedPrice: selectedRide.estimatedPrice,
            originalPrice: selectedRide.originalPrice,
            eta: selectedRide.eta,
            vehicleCategory: selectedRide.vehicleCategory,
            seats: selectedRide.seats
          },
          pickupAddress: pickup,
          destinationAddress: destination,
          stops,
          pickupCoords,
          destinationCoords
        }
      });
    } else if (selectedFleetVehicle) {
      navigate('/confirm-order', {
        state: {
          serviceType,
          vehicle: selectedFleetVehicle,
          extraSelection: extraOption,
          pickupAddress: pickup,
          destinationAddress: destination,
          stops
        }
      });
    }
  };

  // Get icon config for a ride option
  const getRideIconConfig = (pricingId: string) => {
    return RIDE_ICONS[pricingId] || RIDE_ICONS['ride_economy'];
  };

  const isLoading = serviceType === 'ride' ? isLoadingRides : isLoadingFleet;
  const hasOptions = serviceType === 'ride' ? rideOptions.length > 0 : fleetVehicles.length > 0;

  return (
    <div className="fixed inset-0 bg-gray-100 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-blue-50 to-green-100">
        <div className="absolute inset-0 opacity-40">
          <svg className="w-full h-full">
            <defs>
              <pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#cbd5e1" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
            <path
              d="M 200 400 Q 250 300 300 200"
              stroke="#4f46e5"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg" />
        </div>
        <div className="absolute top-2/3 right-1/3">
          <div className="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-lg" />
        </div>

        <motion.div
          className="absolute top-32 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          {selectedRide?.isAvailable 
            ? `Arrive in ~${selectedRide.etaMinutes + 15} min`
            : 'Searching for drivers...'}
        </motion.div>
      </div>

      <motion.div
        className="absolute top-4 left-4 right-4 z-30"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-700" />
          </button>

          <button
            onClick={() => navigate('/your-route', {
              state: {
                highlightDestination: true,
                prefilledDestination: destination,
                prefilledPickup: pickup
              }
            })}
            className="flex-1 text-left min-w-0"
          >
            <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-900">
                  {getAddressDisplay()}
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/your-route', {
              state: {
                highlightAddStop: true,
                prefilledDestination: destination,
                prefilledPickup: pickup
              }
            })}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <Plus size={20} className="text-gray-700" />
          </button>
        </div>
      </motion.div>

      <motion.div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-20 flex flex-col will-change-transform"
        style={{
          height: panelHeightStyle,
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 260, mass: 0.6 }}
      >
        <motion.div
          className="bg-blue-600 text-white w-full px-4 py-3 flex items-center justify-center gap-2 rounded-t-3xl flex-shrink-0 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowPromoDetails(true)}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-white">✓</span>
          <span className="font-medium text-sm">{promo.discount}% promo applied</span>
          <ChevronDown size={16} />
        </motion.div>

        <motion.div
          className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileTap={{ scale: 1.02 }}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="px-4 flex-shrink-0 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
                opacity: { duration: 0.2 }
              }}
            >
              <div className="flex gap-3 mb-4">
                <motion.button
                  onClick={() => setSelectedFilter('recommended')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                    selectedFilter === 'recommended'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.05, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Recommended
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('faster')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'faster'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Faster
                </motion.button>
                <motion.button
                  onClick={() => setSelectedFilter('cheaper')}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-1 whitespace-nowrap ${
                    selectedFilter === 'cheaper'
                      ? 'bg-white border-2 border-green-600 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: 0.15, type: 'spring', damping: 20, stiffness: 300 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cheaper
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: isDragging ? 'none' : 'pan-y'
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading ride options...</p>
              </div>
            </div>
          ) : rideError ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-red-600">{rideError}</p>
            </div>
          ) : !hasOptions ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600">No vehicles available</p>
            </div>
          ) : serviceType === 'ride' ? (
            // Render ride options from Firestore
            <div className="space-y-3 mb-6">
              {sortedRideOptions.map((option, index) => (
                <motion.button
                  key={option.id}
                  onClick={() => option.isAvailable && setSelectedRide(option)}
                  disabled={!option.isAvailable}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    !option.isAvailable 
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : selectedRide?.id === option.id
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: option.isAvailable ? 0.98 : 1 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${getRideIconConfig(option.pricingId).color}`}>
                      <span className="text-2xl">{getRideIconConfig(option.pricingId).emoji}</span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">{option.displayName}</h3>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">R {option.estimatedPrice}</p>
                          {option.originalPrice !== option.estimatedPrice && (
                            <p className="text-sm text-gray-500 line-through">R {option.originalPrice}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className={`text-sm ${option.isAvailable ? 'text-gray-600' : 'text-orange-600'}`}>
                          {option.eta}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Users size={14} className="text-gray-500" />
                          <span className="text-sm text-gray-600">{option.seats}</span>
                        </div>
                      </div>
                      {!option.isAvailable && (
                        <span className="inline-block mt-2 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                          NO DRIVERS
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            // Render fleet vehicles for other services
            <div className="space-y-3 mb-6">
              {sortedFleetVehicles.map((vehicle, index) => (
                <motion.button
                  key={vehicle.id}
                  onClick={() => setSelectedFleetVehicle(vehicle)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all ${
                    selectedFleetVehicle?.id === vehicle.id
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">{vehicle.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">{vehicle.name}</h3>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">R {vehicle.price}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600">{vehicle.eta}</span>
                        {typeof vehicle.capacity === 'number' && (
                          <div className="flex items-center space-x-1">
                            <Users size={14} className="text-gray-500" />
                            <span className="text-sm text-gray-600">{vehicle.capacity}</span>
                          </div>
                        )}
                        {typeof vehicle.capacity === 'string' && (
                          <span className="text-sm text-gray-600">{vehicle.capacity}</span>
                        )}
                        <span className="text-sm text-gray-600">{vehicle.description}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative bg-gray-100 rounded-full p-1 flex items-center flex-shrink-0">
              <motion.div
                className="absolute top-1 bottom-1 left-1 bg-white rounded-full shadow-md"
                animate={{
                  width: 40,
                  x: profileToggle === 'personal' ? 0 : 40
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              />
              <button
                onClick={() => setProfileToggle('personal')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <User size={18} className={profileToggle === 'personal' ? 'text-gray-900' : 'text-gray-400'} />
              </button>
              <button
                onClick={() => setProfileToggle('business')}
                className="relative z-10 w-10 h-10 flex items-center justify-center"
              >
                <Briefcase size={18} className={profileToggle === 'business' ? 'text-gray-900' : 'text-gray-400'} />
              </button>
            </div>

            <motion.button
              onClick={() => console.log('Cash payment clicked')}
              className="py-2 px-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Cash
              <ChevronDown size={14} />
            </motion.button>

            <div className="flex-1" />

            <motion.button
              onClick={() => navigate('/schedule-ride')}
              className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center hover:bg-green-700 transition-colors shadow-lg flex-shrink-0"
              whileTap={{ scale: 0.95 }}
            >
              <Calendar size={20} />
            </motion.button>
          </div>

          <motion.button
            onClick={handleSelectRide}
            disabled={isRideActive || (serviceType === 'ride' ? !selectedRide?.isAvailable : !selectedFleetVehicle)}
            className={`w-full py-3 rounded-2xl font-bold text-base transition-colors shadow-lg ${
              isRideActive || (serviceType === 'ride' ? !selectedRide?.isAvailable : !selectedFleetVehicle)
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            whileTap={{ scale: (isRideActive || !selectedRide?.isAvailable) ? 1 : 0.98 }}
          >
            {isRideActive 
              ? 'Ride Active' 
              : serviceType === 'ride'
                ? selectedRide?.isAvailable 
                  ? `Select ${selectedRide?.displayName}`
                  : 'No drivers available'
                : `Select ${selectedFleetVehicle?.name || ''}`
            }
          </motion.button>
          {isRideActive && (
            <p className="text-gray-500 text-center text-sm mt-2">
              Finish current ride before booking another
            </p>
          )}
        </div>
      </motion.div>

      <PromoDetailsPanel
        isOpen={showPromoDetails}
        onClose={() => setShowPromoDetails(false)}
        promo={promo}
      />
    </div>
  );
};
