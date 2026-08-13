// src/lib/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, getToken, setToken, removeToken, getUser, setUser, removeUser, User } from './api';

interface Ctx {
  loading: boolean;
  showAuthModal: boolean;
  authModalIntent: string;
  authModalTab: 'login' | 'register';
  setAuthModalTab(tab: 'login' | 'register'): void;
  openAuthModal(intent?: string, defaultTab?: 'login' | 'register'): void;
  closeAuthModal(): void;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string, role: string): Promise<void>;
  logout(): void;
  token: string | null;
  user: any;
}

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setU] = useState<User | null>(getUser());
  const [token, setT] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalIntent, setAuthModalIntent] = useState('');
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (getToken() && !user) {
      api.auth.me()
        .then(({ user: u }) => { setU(u); setUser(u); })
        .catch(() => { removeToken(); removeUser(); setT(null); });
    }
  }, []);

  const openAuthModal = (intent = '', defaultTab?: 'login' | 'register') => {
    setAuthModalIntent(intent);
    if (defaultTab) {
      setAuthModalTab(defaultTab);
    } else {
      const lower = intent.toLowerCase();
      if (lower.includes('gratis') || lower.includes('cuenta') || lower.includes('regist') || lower.includes('unirme')) {
        setAuthModalTab('register');
      } else {
        setAuthModalTab('login');
      }
    }
    setShowAuthModal(true);
  };
  const closeAuthModal = () => setShowAuthModal(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { token: t, user: u } = await api.auth.login({ email, password });
      setToken(t); setUser(u); setT(t); setU(u);
      setShowAuthModal(false);
    } finally { setLoading(false); }
  };

  const register = async (name: string, email: string, password: string, role: string) => {
    setLoading(true);
    try {
      const { token: t, user: u } = await api.auth.register({ name, email, password, role });
      setToken(t); setUser(u); setT(t); setU(u);
      setShowAuthModal(false);
    } finally { setLoading(false); }
  };

  const logout = () => { removeToken(); removeUser(); setT(null); setU(null); };

  return (
    <AuthContext.Provider value={{ user, token, loading, showAuthModal, authModalIntent, authModalTab, setAuthModalTab, openAuthModal, closeAuthModal, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
