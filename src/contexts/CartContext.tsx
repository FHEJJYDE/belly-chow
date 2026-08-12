import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  vendorId: string | null;
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('belly_chow_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [vendorId, setVendorId] = useState<string | null>(() => {
    return localStorage.getItem('belly_chow_cart_vendor_id');
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('belly_chow_cart_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (vendorId) {
      localStorage.setItem('belly_chow_cart_vendor_id', vendorId);
    } else {
      localStorage.removeItem('belly_chow_cart_vendor_id');
    }
  }, [vendorId]);

  const addItem = (menuItem: MenuItem) => {
    if (vendorId && vendorId !== menuItem.vendor_id) {
      // Different vendor — clear cart first
      setItems([{ menuItem, quantity: 1 }]);
      setVendorId(menuItem.vendor_id);
      return;
    }
    setVendorId(menuItem.vendor_id);
    setItems(prev => {
      const existing = prev.find(i => i.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(i => i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.menuItem.id !== itemId);
      if (next.length === 0) setVendorId(null);
      return next;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(itemId);
    setItems(prev => prev.map(i => i.menuItem.id === itemId ? { ...i, quantity } : i));
  };

  const clearCart = () => {
    setItems([]);
    setVendorId(null);
    localStorage.removeItem('belly_chow_cart_items');
    localStorage.removeItem('belly_chow_cart_vendor_id');
  };

  const total = items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, vendorId, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
