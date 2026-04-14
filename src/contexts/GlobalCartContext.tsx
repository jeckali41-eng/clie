import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type DeliveryCategory = 'food' | 'clothes' | 'hardware';

export interface GlobalCartItem {
  id: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  category: DeliveryCategory;
  name: string;
  image: string;
  price: number;
}

interface GlobalCartContextType {
  cart: GlobalCartItem[];
  addToCart: (item: GlobalCartItem) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
}

const GlobalCartContext = createContext<GlobalCartContextType | undefined>(undefined);

const STORAGE_KEY = 'GLOBAL_CART';

export const GlobalCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<GlobalCartItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Error loading cart:', error);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    console.log('🛒 Global cart updated:', cart.length);
  }, [cart]);

  const addToCart = useCallback((item: GlobalCartItem) => {
    setCart(prev => [...prev, item]);
    console.log('✅ Added to cart:', item.name);
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    console.log('❌ Removed from cart:', itemId);
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Cart cleared');
  }, []);

  const getCartCount = useCallback(() => {
    return cart.length;
  }, [cart]);

  const value: GlobalCartContextType = {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartCount
  };

  return (
    <GlobalCartContext.Provider value={value}>
      {children}
    </GlobalCartContext.Provider>
  );
};

export const useGlobalCart = () => {
  const context = useContext(GlobalCartContext);
  if (context === undefined) {
    throw new Error('useGlobalCart must be used within GlobalCartProvider');
  }
  return context;
};
