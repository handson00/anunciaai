import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

export type AdCategory = 'automobile' | 'product' | 'property' | 'service';
export type AdCondition = 'new' | 'used';
export type AdStatus = 'draft' | 'ready' | 'published' | 'error';

export interface Profile {
  id: string;
  user_id: string;
  phone: string;
  name: string;
  is_admin: boolean;
  blocked: boolean;
  created_at: string;
  avatar_url?: string | null;
}

export interface Ad {
  id: string;
  user_id: string;
  category: AdCategory;
  title: string;
  description: string;
  price: number;
  condition?: AdCondition | null;
  brand?: string | null;
  region?: string | null;
  main_photo: string;
  photos: string[];
  contact_phone: string;
  status: AdStatus;
  created_at: string;
  slug: string;
  // joined
  user_name?: string;
}

interface AppContextType {
  currentUser: Profile | null;
  authUser: SupabaseUser | null;
  loading: boolean;
  ads: Ad[];
  users: Profile[];
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  register: (phone: string, name: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createAd: (ad: Omit<Ad, 'id' | 'user_id' | 'created_at' | 'slug' | 'status'>) => Promise<Ad | null>;
  updateAd: (id: string, updates: Partial<Ad>) => Promise<void>;
  deleteAd: (id: string) => Promise<void>;
  updateProfile: (updates: { name?: string; avatar_url?: string }) => Promise<void>;
  getAdBySlug: (slug: string) => Promise<Ad | null>;
  getUserAds: () => Promise<Ad[]>;
  fetchAds: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  publishAd: (adId: string) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<Ad[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) {
      setCurrentUser(data as unknown as Profile);
    }
    return data as unknown as Profile | null;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setAuthUser(null);
        setCurrentUser(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const login = async (phone: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const email = `${cleanPhone}@anunciai.app`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: `${cleanPhone}_${pin}`,
    });

    if (error) {
      if (error.message.includes('Invalid login')) {
        // Could be wrong PIN or user doesn't exist — try to distinguish
        return { success: false, error: 'not_found' };
      }
      return { success: false, error: error.message };
    }

    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      if (profile?.blocked) {
        await supabase.auth.signOut();
        return { success: false, error: 'blocked' };
      }
    }

    return { success: true };
  };

  const register = async (phone: string, name: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPhone = phone.replace(/\D/g, '');
    const email = `${cleanPhone}@anunciai.app`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: `${cleanPhone}_${pin}`,
      options: {
        data: { phone: cleanPhone, name },
      },
    });

    if (error) return { success: false, error: error.message };
    if (data.user) {
      // Wait briefly for trigger to create profile
      await new Promise(r => setTimeout(r, 500));
      await fetchProfile(data.user.id);
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setCurrentUser(null);
  };

  const createAd = async (adData: Omit<Ad, 'id' | 'user_id' | 'created_at' | 'slug' | 'status'>): Promise<Ad | null> => {
    if (!authUser) return null;
    const slug = generateSlug(adData.title);

    const { data, error } = await supabase
      .from('ads')
      .insert({
        user_id: authUser.id,
        category: adData.category,
        title: adData.title,
        description: adData.description,
        price: adData.price,
        condition: adData.condition || null,
        brand: adData.brand || null,
        region: adData.region || null,
        main_photo: adData.main_photo,
        photos: adData.photos || [],
        contact_phone: adData.contact_phone,
        slug,
        status: 'draft' as AdStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ad:', error);
      return null;
    }
    return data as Ad;
  };

  const updateAd = async (id: string, updates: Partial<Ad>) => {
    await supabase.from('ads').update(updates).eq('id', id);
  };

  const deleteAd = async (id: string) => {
    await supabase.from('ads').delete().eq('id', id);
  };

  const updateProfile = async (updates: { name?: string; avatar_url?: string }) => {
    if (!authUser) return;
    await supabase.from('profiles').update(updates).eq('user_id', authUser.id);
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updates });
    }
  };

  const getAdBySlug = async (slug: string): Promise<Ad | null> => {
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('slug', slug)
      .single();
    if (!data) return null;
    // Get user name (may fail if not authenticated due to RLS)
    let userName = 'Anunciante';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', data.user_id)
        .single();
      if (profile?.name) userName = profile.name;
    } catch {}
    return { ...data, user_name: userName } as Ad;
  };

  const getUserAds = async (): Promise<Ad[]> => {
    if (!authUser) return [];
    const { data } = await supabase
      .from('ads')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });
    return (data || []) as Ad[];
  };

  const fetchAds = async () => {
    const { data } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });
    setAds((data || []) as Ad[]);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', false)
      .order('created_at', { ascending: false });
    setUsers((data || []) as unknown as Profile[]);
  };

  const publishAd = async (adId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await supabase.functions.invoke('publicar-anuncio', {
        body: { anuncio_id: adId },
      });
      if (response.error) {
        return { success: false, error: response.error.message };
      }
      if (response.data?.error) {
        return { success: false, error: response.data.error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser, authUser, loading, ads, users,
      login, register, logout, createAd, updateAd, deleteAd,
      updateProfile, getAdBySlug, getUserAds, fetchAds, fetchUsers, publishAd,
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
