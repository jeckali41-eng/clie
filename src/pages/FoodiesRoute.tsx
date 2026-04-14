import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Clock, ChevronRight } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { mockDeliveryAddresses, getDeliveryAddressSuggestions } from '../data/mockDeliveryAddresses';

interface Stop {
  id: string;
  address: string;
  description?: string;
  foodIds: string[];
}

export function FoodiesRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: currentLocation } = useGeolocation();
  const { cart, removeFromCart } = useGlobalCart();

  const currentLocationInputRef = useRef<HTMLInputElement>(null);
  const stopInputRefs = useRef<{ [key: string]: HTMLInputElement }>({});

  // Load saved route data from localStorage if available
  const loadRouteData = () => {
    const stored = localStorage.getItem('FOODIES_ROUTE_DATA');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return {
          stops: data.stops || [],
          deliveryLocation: data.deliveryLocation || ''
        };
      } catch (error) {
        console.error('Error loading route data:', error);
      }
    }
    return { stops: [], deliveryLocation: '' };
  };

  const initialData = loadRouteData();

  const [stops, setStops] = useState<Stop[]>(initialData.stops);
  const [deliveryLocation, setDeliveryLocation] = useState(initialData.deliveryLocation);
  const [currentLocationQuery, setCurrentLocationQuery] = useState(initialData.deliveryLocation);
  const [stopAddressQuery, setStopAddressQuery] = useState<{ [key: string]: string }>({});
  const [activeLocationInput, setActiveLocationInput] = useState('current-location');
  const [showRecentAddresses, setShowRecentAddresses] = useState(true);
  const [hasAutoFilled, setHasAutoFilled] = useState(!!initialData.deliveryLocation);
  const [showCurrentLocationModal, setShowCurrentLocationModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState<string | null>(null);

  const assignedToStopsIds = useMemo(() => {
    const ids: string[] = [];
    stops.forEach(stop => {
      ids.push(...stop.foodIds);
    });
    return ids;
  }, [stops]);

  const unselectedFoods = useMemo(() => {
    return cart.filter(food => !assignedToStopsIds.includes(food.id));
  }, [cart, assignedToStopsIds]);

  const maxAssignable = cart.length - 1;
  const MAX_STOPS = 3;
  const canAddStop = unselectedFoods.length > 1 && stops.length < MAX_STOPS;

  console.log('🛒 Cart:', cart.length);
  console.log('📍 Stops:', stops.length);
  console.log('📊 Assigned to stops:', assignedToStopsIds.length);
  console.log('📊 Unselected foods:', unselectedFoods.length);
  console.log('📊 Can add stop:', canAddStop);
  console.log('📊 Max stops reached:', stops.length >= MAX_STOPS);

  useEffect(() => {
    if (currentLocation && !deliveryLocation && !hasAutoFilled) {
      setDeliveryLocation(currentLocation);
      setCurrentLocationQuery(currentLocation);
      setHasAutoFilled(true);
    } else if (deliveryLocation && !currentLocationQuery) {
      setCurrentLocationQuery(deliveryLocation);
    }
  }, [currentLocation, deliveryLocation, hasAutoFilled, currentLocationQuery]);


  useEffect(() => {
    if (location.state) {
      const { highlightCurrentLocation, autoAddStop } = location.state;

      if (highlightCurrentLocation) {
        setActiveLocationInput('current-location');
        setTimeout(() => currentLocationInputRef.current?.focus(), 100);
      }

      if (autoAddStop && canAddStop) {
        handleAddStop();
      }

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleCurrentLocationChange = (value: string) => {
    setCurrentLocationQuery(value);
    setDeliveryLocation(value);
    setShowRecentAddresses(value.length === 0);
  };

  const handleCurrentLocationSelect = (address: string) => {
    setDeliveryLocation(address);
    setCurrentLocationQuery(address);
    setShowRecentAddresses(true);
    setActiveLocationInput('current-location');

    if (stops.length > 0 && !stops[0].address) {
      setTimeout(() => {
        setActiveLocationInput(stops[0].id);
        stopInputRefs.current[stops[0].id]?.focus();
      }, 100);
    }
  };

  const handleClearCurrentLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentLocationQuery('');
    setDeliveryLocation('');
    setShowRecentAddresses(true);
    setTimeout(() => currentLocationInputRef.current?.focus(), 0);
  };

  const handleStopAddressChange = (stopId: string, value: string) => {
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address: value } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: value }));
    setShowRecentAddresses(value.length === 0);
  };

  const handleStopAddressSelect = (stopId: string, address: string, description: string) => {
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address, description } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: '' }));
    setShowRecentAddresses(true);

    const currentIndex = stops.findIndex(s => s.id === stopId);
    if (currentIndex < stops.length - 1) {
      const nextStop = stops[currentIndex + 1];
      if (!nextStop.address) {
        setTimeout(() => {
          setActiveLocationInput(nextStop.id);
          stopInputRefs.current[nextStop.id]?.focus();
        }, 100);
      }
    }
  };

  const handleClearStop = (e: React.MouseEvent, stopId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStops(prev => prev.map(stop =>
      stop.id === stopId ? { ...stop, address: '' } : stop
    ));
    setStopAddressQuery(prev => ({ ...prev, [stopId]: '' }));
    setShowRecentAddresses(true);
    setTimeout(() => stopInputRefs.current[stopId]?.focus(), 0);
  };

  const handleAddStop = () => {
    if (!canAddStop) return;

    const newStop: Stop = {
      id: `stop-${Date.now()}`,
      address: '',
      foodIds: []
    };
    setStops(prev => [...prev, newStop]);
    setTimeout(() => {
      setActiveLocationInput(newStop.id);
      stopInputRefs.current[newStop.id]?.focus();
      setShowRecentAddresses(true);
    }, 100);
  };

  const handleRemoveStop = (stopId: string) => {
    setStops(prev => prev.filter(stop => stop.id !== stopId));
    setActiveLocationInput('current-location');
    setShowRecentAddresses(true);
  };

  const handleToggleFoodForStop = (stopId: string, foodId: string) => {
    setStops(prev => prev.map(stop => {
      if (stop.id !== stopId) return stop;

      const isSelected = stop.foodIds.includes(foodId);
      if (isSelected) {
        return { ...stop, foodIds: stop.foodIds.filter(id => id !== foodId) };
      } else {
        if (assignedToStopsIds.length >= maxAssignable) {
          return stop;
        }
        return { ...stop, foodIds: [...stop.foodIds, foodId] };
      }
    }));
  };

  const handleRemoveFoodFromCurrentLocation = (foodId: string) => {
    const isAssignedToStops = assignedToStopsIds.includes(foodId);
    const isMaxReached = assignedToStopsIds.length >= maxAssignable;

    if (isMaxReached && !isAssignedToStops) {
      return;
    }

    removeFromCart(foodId);

    setStops(prev => prev
      .map(stop => ({
        ...stop,
        foodIds: stop.foodIds.filter(id => id !== foodId)
      }))
      .filter(stop => stop.foodIds.length > 0 || stop.address)
    );
  };

  const handleGoToDelivery = () => {
    // Save route data to localStorage before navigation
    // Get store info from first cart item
    const storeId = cart[0]?.storeId || '';
    const storeName = cart[0]?.storeName || '';
    const storeAddress = cart[0]?.storeAddress || ''; // Real store address from Firestore
    const storeLocation = (cart[0] as any)?.storeLocation || { lat: null, lng: null };
    const category = cart[0]?.category || 'food';
    
    const routeData = {
      deliveryLocation,
      storeId,
      storeName,
      storeAddress,
      storeLocation, // Store GPS coordinates
      category,
      stops: stops.map(stop => ({
        id: stop.id,
        address: stop.address,
        description: stop.description,
        foodIds: stop.foodIds
      })),
      cart: cart.map(item => ({
        id: item.id,
        storeId: item.storeId,
        storeName: item.storeName,
        storeAddress: item.storeAddress,
        category: item.category,
        name: item.name,
        image: item.image,
        price: item.price
      })),
      timestamp: Date.now()
    };

    localStorage.setItem('FOODIES_ROUTE_DATA', JSON.stringify(routeData));
    console.log('📦 Saved route data to localStorage:', routeData);

    navigate('/food-delivery');
  };

  const pickupLocation = cart[0]?.storeName || 'Store';
  const pickupAddress = cart[0]?.storeAddress || '';

  const getFoodCountForStop = (stopId: string): number => {
    const stop = stops.find(s => s.id === stopId);
    return stop ? stop.foodIds.length : 0;
  };

  const getStopButtonText = (stopId: string): string => {
    const count = getFoodCountForStop(stopId);
    if (count === 0) return 'Add item';
    return count === 1 ? `${count} item added` : `${count} items added`;
  };

  const isFoodDisabled = (foodId: string, stopId: string): boolean => {
    const stop = stops.find(s => s.id === stopId);
    if (!stop) return false;

    const isAlreadySelected = stop.foodIds.includes(foodId);
    if (isAlreadySelected) return false;

    const isAssignedToOtherStop = assignedToStopsIds.includes(foodId) && !stop.foodIds.includes(foodId);
    if (isAssignedToOtherStop) return true;

    if (assignedToStopsIds.length >= maxAssignable) return true;

    return false;
  };

  const canDeleteFood = (foodId: string): boolean => {
    const isAssignedToStops = assignedToStopsIds.includes(foodId);
    const isMaxReached = assignedToStopsIds.length >= maxAssignable;

    if (isMaxReached && !isAssignedToStops) {
      return false;
    }

    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-screen bg-gray-50"
    >
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <motion.button
              onClick={() => navigate(-1)}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X size={20} className="text-gray-800" />
            </motion.button>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-900 truncate">{pickupLocation}</span>
                <span className="text-gray-500 flex-shrink-0">→</span>
                <span className="text-sm font-semibold text-gray-900 truncate">{deliveryLocation.split(',')[0] || 'Delivery'}</span>
              </div>
              {pickupAddress && (
                <span className="text-[10px] text-gray-500 truncate">{pickupAddress}</span>
              )}
            </div>

            <motion.button
              onClick={handleAddStop}
              disabled={!canAddStop}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                canAddStop
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              whileTap={{ scale: canAddStop ? 0.95 : 1 }}
            >
              <Plus size={16} />
            </motion.button>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
              <div className={`flex-1 relative flex items-center rounded-lg px-3 py-2 transition-all ${
                activeLocationInput === 'current-location'
                  ? 'bg-white border border-green-500 shadow-sm'
                  : 'bg-gray-100 border border-transparent'
              }`}>
                <input
                  ref={currentLocationInputRef}
                  type="text"
                  value={currentLocationQuery}
                  onChange={(e) => handleCurrentLocationChange(e.target.value)}
                  onFocus={() => {
                    setActiveLocationInput('current-location');
                    setShowRecentAddresses(true);
                  }}
                  placeholder="Delivery location"
                  className="flex-1 bg-transparent text-gray-900 text-xs outline-none"
                />
                {currentLocationQuery && (
                  <motion.button
                    onClick={handleClearCurrentLocation}
                    onMouseDown={(e) => e.preventDefault()}
                    className="mr-2 w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center hover:bg-gray-400 transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={10} className="text-white" />
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setShowCurrentLocationModal(true)}
                  disabled={cart.length === 0}
                  className="relative ml-2 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileTap={{ scale: cart.length > 0 ? 0.95 : 1 }}
                >
                   
                  <span className="text-[10px] font-medium text-gray-700">View your {unselectedFoods.length === 1 ? 'item' : 'items'}</span>
                  {unselectedFoods.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      {unselectedFoods.length}
                    </motion.span>
                  )}
                </motion.button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {stops.map((stop) => (
              <motion.div
                key={stop.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 relative"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <div className={`flex-1 relative flex items-center rounded-lg px-3 py-2 transition-all ${
                    activeLocationInput === stop.id
                      ? 'bg-white border border-green-500 shadow-sm'
                      : 'bg-gray-100 border border-transparent'
                  }`}>
                    <input
                      ref={(el) => {
                        if (el) stopInputRefs.current[stop.id] = el;
                      }}
                      type="text"
                      value={stop.address ?? ''}
                      onChange={(e) => handleStopAddressChange(stop.id, e.target.value)}
                      onFocus={() => {
                        setActiveLocationInput(stop.id);
                        setShowRecentAddresses(true);
                      }}
                      placeholder="Stop location"
                      className="flex-1 bg-transparent text-gray-900 text-xs outline-none"
                    />
                    {stop.address && (
                      <motion.button
                        onClick={(e) => handleClearStop(e, stop.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="mr-2 w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center hover:bg-gray-400 transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <X size={10} className="text-white" />
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setShowStopModal(stop.id)}
                      className="ml-2 px-2 py-1 bg-gray-50 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors relative"
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-[10px] font-medium text-gray-700">
                        {getStopButtonText(stop.id)}
                      </span>
                      {getFoodCountForStop(stop.id) > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                        >
                          {getFoodCountForStop(stop.id)}
                        </motion.span>
                      )}
                    </motion.button>
                  </div>
                  <button
                    onClick={() => handleRemoveStop(stop.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <X size={14} className="text-red-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-40 px-3 pb-20">
        {showRecentAddresses && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 px-2">
              {currentLocationQuery === '' ? 'Suggested locations' : 'Recent addresses'}
            </p>

            {currentLocationQuery === '' && currentLocation && activeLocationInput === 'current-location' && (
              <motion.button
                onClick={() => handleCurrentLocationSelect(currentLocation)}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors shadow-sm border border-blue-200"
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 text-xs">Current location</p>
                  <p className="text-[10px] text-gray-600">{currentLocation.split(',')[0]}</p>
                </div>
              </motion.button>
            )}

            {mockDeliveryAddresses.slice(0, 5).map((addr) => (
              <motion.button
                key={addr.id}
                onClick={() => {
                  if (activeLocationInput === 'current-location') {
                    handleCurrentLocationSelect(addr.address);
                  } else {
                    handleStopAddressSelect(activeLocationInput as string, addr.address, addr.description);
                  }
                }}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                whileTap={{ scale: 0.98 }}
              >
                <Clock size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 text-xs">{addr.name}</p>
                  <p className="text-[10px] text-gray-500">{addr.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <motion.div
        className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-100 z-20"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.2 }}
      >
        <motion.button
          onClick={handleGoToDelivery}
          disabled={cart.length === 0}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            cart.length > 0
              ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          whileTap={{ scale: cart.length > 0 ? 0.98 : 1 }}
          whileHover={{ scale: cart.length > 0 ? 1.02 : 1 }}
        >
          Go to delivery
          <motion.div
            animate={{ x: [0, 3, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          >
            <ChevronRight size={16} />
          </motion.div>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showCurrentLocationModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCurrentLocationModal(false)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                <h2 className="text-xl font-bold text-gray-900">Your {unselectedFoods.length === 1 ? 'Item' : 'Items'} ({unselectedFoods.length})</h2>
                <motion.button
                  onClick={() => setShowCurrentLocationModal(false)}
                  className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={20} className="text-gray-600" />
                </motion.button>
              </div>

              <div className="px-6 py-4 space-y-3 pb-24">
                {cart.map((item, index) => {
                  const canDelete = canDeleteFood(item.id);

                  return (
                    <motion.div
                      key={item.id}
                      className="w-full p-4 rounded-2xl border-2 border-gray-200 bg-white flex items-center space-x-4"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 text-left">
                        <h3 className="font-bold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">K{item.price}</p>
                      </div>

                      {canDelete && (
                        <motion.button
                          onClick={() => handleRemoveFoodFromCurrentLocation(item.id)}
                          className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          whileTap={{ scale: 0.9 }}
                        >
                          <X size={16} className="text-white" />
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStopModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStopModal(null)}
            />

            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                <h2 className="text-xl font-bold text-gray-900">Select Items for Stop</h2>
                <motion.button
                  onClick={() => setShowStopModal(null)}
                  className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={20} className="text-gray-600" />
                </motion.button>
              </div>

              <div className="px-6 py-4 space-y-3 pb-24">
                {cart.map((item, index) => {
                  const stop = stops.find(s => s.id === showStopModal);
                  const isSelected = stop?.foodIds.includes(item.id) || false;
                  const isDisabled = isFoodDisabled(item.id, showStopModal);

                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => !isDisabled && handleToggleFoodForStop(showStopModal, item.id)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center space-x-4 ${
                        isSelected
                          ? 'border-green-600 bg-green-50'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 text-left">
                        <h3 className="font-bold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">K{item.price}</p>
                      </div>

                      {isSelected && (
                        <motion.div
                          className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                        >
                          <span className="text-white text-sm">✓</span>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <motion.div
                className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6"
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.button
                  onClick={() => setShowStopModal(null)}
                  className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl hover:bg-green-700 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  OK
                </motion.button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
