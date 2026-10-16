// src/lib/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, ApiError, getToken, setToken, removeToken, getUser, setUser, removeUser, User } from './api';

interface Ctx {
  loading: boolean;
  initializing: boolean;
  showAuthModal: boolean;
  authModalIntent: string;
  authModalTab: 'login' | 'register';
  setAuthModalTab(tab: 'login' | 'register'): void;
  openAuthModal(intent?: string, defaultTab?: 'login' | 'register'): void;
  closeAuthModal(): void;
  login(email: string, password: string): Promise<User>;
  register(name: string, email: string, password: string, role: string): Promise<User>;
  logout(): void;
  /** Reemplaza el usuario de la sesión (p. ej. después de cambiar la foto), en memoria y en localStorage. */
  updateUser(u: User): void;
  token: string | null;
  user: User | null;
}

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setU] = useState<User | null>(null);
  const [token, setT] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(false);
  // True while we're verifying an existing token on startup
  const [initializing, setInitializing] = useState(!!getToken());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalIntent, setAuthModalIntent] = useState('');
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      api.auth.me()
        .then(({ user: u }) => { setU(u); setUser(u); })
        .catch((err) => {
          // Solo se cierra la sesión si de verdad no vale: token inválido/vencido (401) o usuario que ya no
          // existe (404). Antes se cerraba ante CUALQUIER error: con Render "dormido" (502), sin red o con
          // un 500, el usuario perdía la sesión (REVISION F4). En esos casos se sigue con el usuario guardado.
          if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
            removeToken(); removeUser(); setT(null);
          } else {
            setU(getUser());
          }
        })
        .finally(() => setInitializing(false));
    } else {
      // No token — nothing to verify, resolve immediately
      setInitializing(false);
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
      return u;
    } finally { setLoading(false); }
  };

  const register = async (name: string, email: string, password: string, role: string) => {
    setLoading(true);
    try {
      const { token: t, user: u } = await api.auth.register({ name, email, password, role });
      setToken(t); setUser(u); setT(t); setU(u);
      setShowAuthModal(false);
      return u;
    } finally { setLoading(false); }
  };

  const logout = () => { removeToken(); removeUser(); setT(null); setU(null); };
  const updateUser = (u: User) => { setUser(u); setU(u); };

  return (
    <AuthContext.Provider value={{ user, token, loading, initializing, showAuthModal, authModalIntent, authModalTab, setAuthModalTab, openAuthModal, closeAuthModal, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
