import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AdCategory = 'automobile' | 'product' | 'property' | 'service';
export type AdCondition = 'new' | 'used';
export type AdStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id: string;
  phone: string;
  name: string;
  isAdmin: boolean;
  blocked: boolean;
  createdAt: string;
}

export interface Ad {
  id: string;
  userId: string;
  category: AdCategory;
  title: string;
  description: string;
  price: number;
  condition?: AdCondition;
  brand?: string;
  mainPhoto: string;
  photos: string[];
  contactPhone: string;
  status: AdStatus;
  createdAt: string;
  slug: string;
  userName: string;
}

interface AppContextType {
  currentUser: User | null;
  users: User[];
  ads: Ad[];
  login: (phone: string) => User | null;
  register: (phone: string, name: string) => User;
  logout: () => void;
  createAd: (ad: Omit<Ad, 'id' | 'userId' | 'createdAt' | 'slug' | 'status' | 'userName'>) => Ad;
  updateAd: (id: string, updates: Partial<Ad>) => void;
  deleteAd: (id: string) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  getAdBySlug: (slug: string) => Ad | undefined;
  getUserAds: () => Ad[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const ADMIN_PHONE = '00000000000';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('anunciai_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('anunciai_users');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'admin-1',
      phone: ADMIN_PHONE,
      name: 'Administrador',
      isAdmin: true,
      blocked: false,
      createdAt: new Date().toISOString(),
    }];
  });

  const [ads, setAds] = useState<Ad[]>(() => {
    const saved = localStorage.getItem('anunciai_ads');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('anunciai_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('anunciai_ads', JSON.stringify(ads));
  }, [ads]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('anunciai_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('anunciai_current_user');
    }
  }, [currentUser]);

  const login = (phone: string): User | null => {
    const cleanPhone = phone.replace(/\D/g, '');
    const user = users.find(u => u.phone === cleanPhone);
    if (user) {
      if (user.blocked) return null;
      setCurrentUser(user);
      return user;
    }
    return null;
  };

  const register = (phone: string, name: string): User => {
    const cleanPhone = phone.replace(/\D/g, '');
    const newUser: User = {
      id: generateId(),
      phone: cleanPhone,
      name,
      isAdmin: false,
      blocked: false,
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    return newUser;
  };

  const logout = () => setCurrentUser(null);

  const createAd = (adData: Omit<Ad, 'id' | 'userId' | 'createdAt' | 'slug' | 'status' | 'userName'>): Ad => {
    const newAd: Ad = {
      ...adData,
      id: generateId(),
      userId: currentUser!.id,
      userName: currentUser!.name,
      createdAt: new Date().toISOString(),
      slug: generateSlug(adData.title),
      status: 'active',
    };
    setAds(prev => [newAd, ...prev]);
    return newAd;
  };

  const updateAd = (id: string, updates: Partial<Ad>) => {
    setAds(prev => prev.map(ad => ad.id === id ? { ...ad, ...updates } : ad));
  };

  const deleteAd = (id: string) => {
    setAds(prev => prev.filter(ad => ad.id !== id));
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    if (currentUser?.id === id) {
      setCurrentUser(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const getAdBySlug = (slug: string) => ads.find(ad => ad.slug === slug);
  const getUserAds = () => ads.filter(ad => ad.userId === currentUser?.id);

  return (
    <AppContext.Provider value={{
      currentUser, users, ads, login, register, logout,
      createAd, updateAd, deleteAd, updateUser, getAdBySlug, getUserAds,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
