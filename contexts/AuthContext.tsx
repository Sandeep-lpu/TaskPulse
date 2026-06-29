import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleAccessToken: string | null;
  signInWithGoogle: (requestCalendarScope?: boolean) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  googleAccessToken: null,
  signInWithGoogle: async () => {},
  logout: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('googleAccessToken');
    const expiry = localStorage.getItem('googleAccessTokenExpiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      return token;
    }
    return null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const signInWithGoogle = async (requestCalendarScope = false) => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const provider = new GoogleAuthProvider();
      if (requestCalendarScope) {
        provider.addScope('https://www.googleapis.com/auth/calendar');
      }
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        localStorage.setItem('googleAccessToken', credential.accessToken);
        localStorage.setItem('googleAccessTokenExpiry', (Date.now() + 3500 * 1000).toString());
      }
      return result;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    await auth.signOut();
    setGoogleAccessToken(null);
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleAccessTokenExpiry');
  };

  return (
    <AuthContext.Provider value={{ user, loading, googleAccessToken, signInWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
