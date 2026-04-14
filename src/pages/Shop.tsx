import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Star, ChevronRight } from 'lucide-react';
import { Store, StoreCategory } from '../data/storesData';
import { fetchStoresByCategory, isStoreOpen } from '../services/storeService';

export const Shop: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get category from navigation state, default to 'food'
  const category: StoreCategory = (location.state?.category as StoreCategory) || 'food';

  // Fetch stores from Firestore
  useEffect(() => {
    const loadStores = async () => {
      setLoading(true);
      try {
        const fetchedStores = await fetchStoresByCategory(category);
        setStores(fetchedStores);
      } catch (error) {
        console.error('Error fetching stores:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStores();
  }, [category]);

  // Get page title based on category
  const getPageTitle = () => {
    switch (category) {
      case 'food':
        return 'Foodies';
      case 'clothes':
        return 'Clothes & Others';
      case 'hardware':
        return 'Hardware';
      default:
        return 'Aletwende Send';
    }
  };

  // Get category tag text
  const getCategoryTag = () => {
    switch (category) {
      case 'food':
        return 'Food Shops';
      case 'clothes':
        return 'Clothing Stores';
      case 'hardware':
        return 'Hardware Stores';
      default:
        return 'Shops';
    }
  };

  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) {
      return stores;
    }
    return stores.filter(store =>
      store.storeName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, stores]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 12, stiffness: 100 }
    }
  };

  const handleStoreClick = (store: Store) => {
    // Check if store is open
    const { isOpen } = isStoreOpen(store.openingHours);
    if (!isOpen) {
      return; // Don't navigate if store is closed
    }

    // Navigate to the appropriate order page based on category
    let orderPath = '/order-foodies';
    if (category === 'clothes') {
      orderPath = '/order-clothes';
    } else if (category === 'hardware') {
      orderPath = '/order-hardware';
    }
    
    navigate(`${orderPath}/${store.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-4"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <div className="flex items-center space-x-4 mb-4">
          <motion.button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </motion.button>
          <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
        </div>

        {/* Search Box */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search stores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-full pl-12 pr-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          />
        </motion.div>
      </motion.div>

      {/* Category Tag */}
      <motion.div
        className="px-4 py-4 flex justify-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="inline-block bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-600 rounded-full px-6 py-2">
          <span className="font-semibold text-green-700">{getCategoryTag()}</span>
        </div>
      </motion.div>

      {/* Stores List */}
      <div className="px-4 pb-24">
        {filteredStores.length > 0 ? (
          <motion.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredStores.map((store) => {
              const { isOpen, nextOpenTime } = isStoreOpen(store.openingHours);
              
              return (
                <motion.button
                  key={store.id}
                  onClick={() => handleStoreClick(store)}
                  className={`w-full bg-white rounded-2xl border border-gray-200 transition-all overflow-hidden ${
                    isOpen 
                      ? 'hover:border-green-300 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  variants={itemVariants}
                  whileTap={isOpen ? { scale: 0.98 } : {}}
                  whileHover={isOpen ? { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } : {}}
                  disabled={!isOpen}
                >
                  <div className="flex items-center space-x-4 p-4">
                    {/* Store Image */}
                    <div className="w-20 h-20 rounded-2xl bg-gray-200 overflow-hidden flex-shrink-0 relative">
                      {store.logo ? (
                        <img
                          src={store.logo}
                          alt={store.storeName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                          <span className="text-2xl">🏪</span>
                        </div>
                      )}
                      {/* Open/Closed Badge */}
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isOpen 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </div>
                    </div>

                    {/* Store Info */}
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{store.storeName}</h3>

                      {/* Distance and Rating */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center space-x-1">
                          <span>📍</span>
                          <span>{store.distance_km ? `${store.distance_km.toFixed(1)} km` : '-- km'}</span>
                        </div>
                        {store.rating && (
                          <div className="flex items-center space-x-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span>{store.rating}</span>
                          </div>
                        )}
                      </div>

                      {/* Delivery Time or Closed Status */}
                      {isOpen ? (
                        <p className="text-sm text-gray-600">{store.delivery_time || '-- min'}</p>
                      ) : (
                        <p className="text-sm text-red-600">
                          {nextOpenTime ? `Opens ${nextOpenTime}` : 'Currently closed'}
                        </p>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="text-gray-400">
                      <ChevronRight size={24} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            className="flex flex-col items-center justify-center py-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No stores found</h3>
            <p className="text-gray-600">Try searching for a different store</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
