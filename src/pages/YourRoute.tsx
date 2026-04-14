import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MapPin, Clock, Navigation, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapBackground } from '../components/MapBackground';
import { ScrollableSection } from '../components/ScrollableSection';
import { useGeolocation } from '../hooks/useGeolocation';
import { getAddressSuggestions } from '../data/addressSuggestions';

interface YourRouteProps {
  onRouteComplete?: (pickup: string, destination: string, stops: string[]) => void;
}

type ServiceType = 'ride' | 'package' | 'towing' | 'truck';

export const YourRoute: React.FC<YourRouteProps> = ({ onRouteComplete }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address: currentLocation, loading: locationLoading } = useGeolocation();

  const serviceType: ServiceType = location.state?.serviceType || 'ride';

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [stops, setStops] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'destination' | number>('destination');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState(getAddressSuggestions(''));
  const [extraOption, setExtraOption] = useState('');

  useEffect(() => {
    if (currentLocation && !pickup) {
      setPickup(currentLocation);
    }
  }, [currentLocation, pickup]);

  useEffect(() => {
    // Handle navigation state from SelectRide page
    if (location.state) {
      const { highlightDestination, highlightAddStop, prefilledDestination, prefilledPickup } = location.state;
      
      if (prefilledPickup) {
        setPickup(prefilledPickup);
      }
      
      if (prefilledDestination) {
        setDestination(prefilledDestination);
      }
      
      if (highlightDestination) {
        setActiveField('destination');
        setSearchQuery(prefilledDestination || '');
      } else if (highlightAddStop) {
        setStops(['']);
        setActiveField(0);
        setSearchQuery('');
      } else {
        // Default to highlighting destination if no specific field is requested
        setActiveField('destination');
      }
    } else {
      // Default to highlighting destination on initial load
      setActiveField('destination');
    }
  }, [location.state]);

  useEffect(() => {
    setSuggestions(getAddressSuggestions(searchQuery));
  }, [searchQuery]);

  // Function to find the next empty field
  const getNextEmptyField = (): 'pickup' | 'destination' | number | null => {
    if (!pickup) return 'pickup';
    if (!destination) return 'destination';
    
    // Check for empty stops
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i] || stops[i].trim() === '') {
        return i;
      }
    }
    
    return null; // No empty fields
  };

  // Function to check if all required fields are filled
  const areAllFieldsFilled = (): boolean => {
    const hasPickup = pickup && pickup.trim() !== '';
    const hasDestination = destination && destination.trim() !== '';
    const allStopsFilled = stops.length === 0 || stops.every(stop => stop && stop.trim() !== '');
    
    return hasPickup && hasDestination && allStopsFilled;
  };
  const handleFieldFocus = (field: 'pickup' | 'destination' | number) => {
    setActiveField(field);
    if (field === 'pickup') {
      setSearchQuery(pickup);
    } else if (field === 'destination') {
      setSearchQuery(destination);
    } else {
      setSearchQuery(stops[field] || '');
    }
  };

  const handleSuggestionSelect = (address: string) => {
    if (activeField === 'pickup') {
      setPickup(address);
    } else if (activeField === 'destination') {
      setDestination(address);
    } else if (typeof activeField === 'number') {
      const newStops = [...stops];
      newStops[activeField] = address;
      setStops(newStops);
    }

    setSearchQuery('');

    // Auto-navigate to next empty field or complete the route
    setTimeout(() => {
      const nextField = getNextEmptyField();

      if (nextField !== null) {
        // Move to next empty field
        setActiveField(nextField);
        if (nextField === 'pickup') {
          setSearchQuery(pickup);
        } else if (nextField === 'destination') {
          setSearchQuery(destination);
        } else {
          setSearchQuery(stops[nextField] || '');
        }
      } else if (areAllFieldsFilled() && serviceType === 'ride') {
        // Only auto-navigate for ride service type
        onRouteComplete?.(pickup, destination, stops);
        navigate('/select-ride');
      }
    }, 100);
  };

  const handleAddStop = () => {
    if (stops.length < 3) {
      const newStops = [...stops, ''];
      setStops(newStops);
      setActiveField(newStops.length - 1);
      setSearchQuery('');
    }
  };

  const handleRemoveStop = (index: number) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    
    // If we removed the active field, move to destination or next empty field
    if (activeField === index) {
      const nextField = getNextEmptyField();
      setActiveField(nextField || 'destination');
    }
  };

  const handleInputChange = (value: string) => {
    if (activeField === 'pickup') {
      setPickup(value);
    } else if (activeField === 'destination') {
      setDestination(value);
    } else if (typeof activeField === 'number') {
      const newStops = [...stops];
      newStops[activeField] = value;
      setStops(newStops);
    }
    
    setSearchQuery(value);
  };

  const getPlaceholder = (field: 'pickup' | 'destination' | number) => {
    if (field === 'pickup') return 'Search pick-up location';
    if (field === 'destination') return 'Destination';
    return 'Add stop';
  };

  const isFieldActive = (field: 'pickup' | 'destination' | number): boolean => {
    return activeField === field;
  };

  const getButtonLabel = (): string => {
    switch (serviceType) {
      case 'towing':
        return 'Go to Select Tow';
      case 'package':
        return 'Go to Select Delivery';
      case 'truck':
        return 'Go to Select Truck';
      default:
        return '';
    }
  };

  const handleLogisticsNavigate = () => {
    if (!pickup || !destination || !extraOption) return;

    onRouteComplete?.(pickup, destination, stops);
    navigate('/select-ride', {
      state: {
        serviceType,
        pickup,
        destination,
        stops,
        extraOption
      }
    });
  };

  const isLogisticsButtonEnabled = (): boolean => {
    return pickup !== '' && destination !== '' && extraOption !== '';
  };

  const renderTowingOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200"
    >
      <label className="block text-sm font-semibold text-gray-900 mb-3">What's your vehicle?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white border-2 border-orange-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
      >
        <option value="">Select vehicle type</option>
        <option value="sedan">Sedan</option>
        <option value="suv">SUV</option>
        <option value="bakkie">Bakkie</option>
        <option value="small-truck">Small Truck</option>
        <option value="van">Van</option>
      </select>
    </motion.div>
  );

  const renderPackageOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border border-gray-300"
    >
      <label className="block text-sm font-semibold text-gray-900 mb-3">What's the weight of your package?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white border-2 border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
      >
        <option value="">Select weight</option>
        <option value="0-5kg">0–5 kg</option>
        <option value="5-10kg">5–10 kg</option>
        <option value="10-20kg">10–20 kg</option>
        <option value="20-50kg">20–50 kg</option>
      </select>
    </motion.div>
  );

  const renderTruckOptions = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl border border-cyan-200"
    >
      <label className="block text-sm font-semibold text-gray-900 mb-3">What do you want to move?</label>
      <select
        value={extraOption}
        onChange={(e) => setExtraOption(e.target.value)}
        className="w-full bg-white border-2 border-cyan-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
      >
        <option value="">Select item type</option>
        <option value="house-shifting">House Shifting</option>
        <option value="farm-produce">Farm Produce</option>
        <option value="construction-material">Construction Material</option>
        <option value="building-sand">Building Sand</option>
        <option value="furniture">Furniture</option>
        <option value="bulk-goods">Bulk Goods</option>
      </select>
    </motion.div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-50">
      <MapBackground />
      
      {/* Header */}
      <motion.div 
        className="absolute top-0 left-0 right-0 z-10 p-4 bg-white shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              // Always use navigate(-1) to go back in the stack
              // This prevents the loop between YourRoute and AletwendeSend
              navigate(-1);
            }}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-800" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Your route</h1>
          <div className="w-10" />
        </div>
      </motion.div>

      {/* Route Form */}
      <motion.div 
        className="absolute top-16 left-0 right-0 bottom-0 bg-white z-10 p-4 pt-8"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="space-y-4">
          {/* Pickup Location */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={pickup}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => handleFieldFocus('pickup')}
                placeholder={locationLoading ? 'Getting your location...' : getPlaceholder('pickup')}
                className={`w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none transition-all ${
                  isFieldActive('pickup') 
                    ? 'ring-2 ring-green-500 bg-white shadow-lg shadow-green-500/20 border-2 border-green-500' 
                    : 'focus:ring-2 focus:ring-green-500 focus:bg-white'
                }`}
                disabled={locationLoading}
              />
              {pickup && activeField === 'pickup' && (
                <button
                  onClick={() => {
                    setPickup('');
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center"
                >
                  <X size={14} className="text-gray-600" />
                </button>
              )}
            </div>
            <button
              onClick={handleAddStop}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
              disabled={stops.length >= 3}
            >
              <Plus size={20} className={stops.length >= 3 ? 'text-gray-300' : 'text-gray-600'} />
            </button>
          </div>

          {/* Add Stops */}
          <AnimatePresence>
            {stops.map((stop, index) => (
              <motion.div
                key={index}
                className="flex items-center space-x-3 ml-6"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={stop}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => handleFieldFocus(index)}
                    placeholder={getPlaceholder(index)}
                    className={`w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none transition-all ${
                      isFieldActive(index) 
                        ? 'ring-2 ring-green-500 bg-white shadow-lg shadow-green-500/20 border-2 border-green-500' 
                        : 'focus:ring-2 focus:ring-green-500 focus:bg-white'
                    }`}
                  />
                </div>
                <button
                  onClick={() => handleRemoveStop(index)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={16} className="text-red-500" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Destination */}
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0"></div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={destination}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => handleFieldFocus('destination')}
                placeholder={getPlaceholder('destination')}
                className={`w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none transition-all ${
                  isFieldActive('destination')
                    ? 'ring-2 ring-green-500 bg-white shadow-lg shadow-green-500/20 border-2 border-green-500'
                    : 'focus:ring-2 focus:ring-green-500 focus:bg-white'
                }`}
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            </div>
            <div className="w-10 flex items-center justify-center">
              <div className="flex flex-col space-y-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </div>
          </div>

          {serviceType === 'towing' && renderTowingOptions()}
          {serviceType === 'package' && renderPackageOptions()}
          {serviceType === 'truck' && renderTruckOptions()}

          {/* Address Suggestions */}
          <ScrollableSection maxHeight="max-h-96">
            <div className="space-y-2 mt-6">
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.id}
                  onClick={() => handleSuggestionSelect(suggestion.address)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Clock className="text-gray-400 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{suggestion.address}</p>
                    <p className="text-sm text-gray-500 truncate">{suggestion.description}</p>
                  </div>
                  {suggestion.distance && (
                    <span className="text-sm text-gray-400 flex-shrink-0">{suggestion.distance}</span>
                  )}
                </motion.button>
              ))}
              
              {/* My Location Option */}
              <motion.button
                onClick={() => handleSuggestionSelect(currentLocation || 'Current Location')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: suggestions.length * 0.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Navigation className="text-blue-500 flex-shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-blue-600">My location</p>
                  {currentLocation && (
                    <p className="text-sm text-gray-500 truncate">{currentLocation}</p>
                  )}
                </div>
              </motion.button>
            </div>
          </ScrollableSection>
        </div>

        {/* Dynamic Bottom Button - Only for non-ride services */}
        {serviceType !== 'ride' && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', damping: 20, stiffness: 300 }}
          >
            <motion.button
              onClick={handleLogisticsNavigate}
              disabled={!isLogisticsButtonEnabled()}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                !isLogisticsButtonEnabled()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl'
              }`}
              whileTap={!isLogisticsButtonEnabled() ? {} : { scale: 0.98 }}
              whileHover={!isLogisticsButtonEnabled() ? {} : { y: -2 }}
            >
              {getButtonLabel()}
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
