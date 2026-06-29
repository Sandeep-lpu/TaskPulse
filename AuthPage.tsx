import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FluidBackground from './components/FluidBackground';
import CustomCursor from './components/CustomCursor';
import GradientText from './components/GlitchText';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result: any = await signInWithGoogle();
      
      // Check if user document exists, if not create it
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          name: result.user.displayName || 'User',
          email: result.user.email,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request') {
        // User cancelled, ignore
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked by browser. Please allow popups for this site.');
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized. Please go to Firebase Console > Authentication > Settings > Authorized domains, and add this app\'s URL (e.g., ais-dev-2ygqyc...run.app).');
      } else {
        setError(err.message || 'An error occurred during Google Sign In.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        import('firebase/auth').then(({ signInWithEmailAndPassword }) => {
            signInWithEmailAndPassword(auth, email, password).catch((err: any) => {
                if (err.code === 'auth/operation-not-allowed') {
                    setError('Email/Password authentication is not enabled. Please enable it in your Firebase Console under Build > Authentication > Sign-in method.');
                } else {
                    setError(err.message || 'An error occurred during authentication.');
                }
                setLoading(false);
            });
        });
      } else {
        import('firebase/auth').then(({ createUserWithEmailAndPassword }) => {
            createUserWithEmailAndPassword(auth, email, password).then(async (userCredential) => {
                // Create user profile in Firestore
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                  name: name || 'User',
                  email,
                  createdAt: serverTimestamp()
                });
                setLoading(false);
            }).catch((err: any) => {
                if (err.code === 'auth/operation-not-allowed') {
                    setError('Email/Password authentication is not enabled. Please enable it in your Firebase Console under Build > Authentication > Sign-in method.');
                } else {
                    setError(err.message || 'An error occurred during authentication.');
                }
                setLoading(false);
            });
        });
      }
    } catch (err: any) {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center text-white selection:bg-[#4fb7b3] selection:text-black cursor-auto md:cursor-none overflow-hidden px-4">
      <CustomCursor />
      <FluidBackground />
      
      {/* Decorative Overlays */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#31326f]/50 via-transparent to-[#4fb7b3]/20 pointer-events-none z-0" />

      {/* Back Button */}
      <Link 
        to="/" 
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-sm font-bold tracking-widest uppercase hover:text-[#a8fbd3] transition-colors cursor-pointer"
        data-hover="true"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Home
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <GradientText 
            text="TASKPULSE" 
            as="h1" 
            className="text-4xl md:text-5xl font-black tracking-tighter mb-2" 
          />
          <p className="text-[#a8fbd3] font-mono text-sm tracking-[0.2em] uppercase">
            Authenticate Session
          </p>
        </div>

        <div className="bg-[#1a1b3b]/80 border border-white/10 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden group">
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#4fb7b3] to-transparent opacity-50" />
          
          {/* Tabs */}
          <div className="flex mb-8 border-b border-white/10 relative">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-4 text-sm font-bold tracking-widest uppercase transition-colors relative cursor-pointer ${isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
              data-hover="true"
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-4 text-sm font-bold tracking-widest uppercase transition-colors relative cursor-pointer ${!isLogin ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
              data-hover="true"
            >
              Sign Up
            </button>
            
            {/* Active Tab Indicator */}
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 h-0.5 bg-[#4fb7b3] w-1/2"
              initial={false}
              animate={{ left: isLogin ? '0%' : '50%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.form
                key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center"
                onSubmit={handleSubmit}
              >
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm font-mono text-left">
                    {error}
                  </div>
                )}
                
                {!isLogin && (
                  <div className="space-y-2 text-left">
                    <label className="text-xs font-mono tracking-widest text-white/50 uppercase">Designation</label>
                    <div className="relative flex items-center">
                      <User className="absolute left-4 w-5 h-5 text-white/30" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name" 
                        required={!isLogin}
                        className="w-full bg-black/30 border border-white/10 py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#4fb7b3] transition-colors cursor-text"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 text-left">
                  <label className="text-xs font-mono tracking-widest text-white/50 uppercase">Signal ID</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-4 w-5 h-5 text-white/30" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address" 
                      required
                      className="w-full bg-black/30 border border-white/10 py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#4fb7b3] transition-colors cursor-text"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-mono tracking-widest text-white/50 uppercase">Security Code</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-4 w-5 h-5 text-white/30" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password" 
                      required
                      className="w-full bg-black/30 border border-white/10 py-3 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#4fb7b3] transition-colors cursor-text"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 text-sm font-bold uppercase tracking-[0.2em] border border-[#4fb7b3]/50 bg-[#4fb7b3]/10 hover:bg-[#4fb7b3] hover:text-black transition-all duration-300 mt-8 flex items-center justify-center gap-3 group cursor-pointer relative overflow-hidden disabled:opacity-50"
                  data-hover="true"
                >
                  <span className="relative z-10">{loading ? 'Processing...' : (isLogin ? 'Login to TaskPulse' : 'Create Account')}</span>
                  <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-[#4fb7b3] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out z-0" />
                </button>

                <div className="flex items-center gap-4 py-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-mono text-white/40 uppercase tracking-widest">or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <button 
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-4 text-sm font-bold uppercase tracking-[0.2em] border border-[#4fb7b3]/50 bg-[#4fb7b3]/10 hover:bg-[#4fb7b3] hover:text-black transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 group relative overflow-hidden"
                  data-hover="true"
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.81 15.69 17.61V20.35H19.26C21.35 18.42 22.56 15.6 22.56 12.25Z" fill="currentColor"/>
                      <path d="M12 23C14.97 23 17.46 22.02 19.26 20.35L15.69 17.61C14.71 18.27 13.46 18.66 12 18.66C9.17 18.66 6.77 16.75 5.88 14.18H2.21V17.02C4.01 20.59 7.69 23 12 23Z" fill="currentColor"/>
                      <path d="M5.88 14.18C5.65 13.51 5.52 12.77 5.52 12C5.52 11.23 5.65 10.49 5.88 9.82V6.98H2.21C1.47 8.46 1.05 10.18 1.05 12C1.05 13.82 1.47 15.54 2.21 17.02L5.88 14.18Z" fill="currentColor"/>
                      <path d="M12 5.34C13.62 5.34 15.07 5.9 16.21 6.98L19.34 3.85C17.45 2.09 14.97 1 12 1C7.69 1 4.01 3.41 2.21 6.98L5.88 9.82C6.77 7.25 9.17 5.34 12 5.34Z" fill="currentColor"/>
                    </svg>
                    {loading ? 'Processing...' : 'Continue with Google'}
                  </span>
                  <div className="absolute inset-0 bg-[#4fb7b3] transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out z-0" />
                </button>
              </motion.form>
            </AnimatePresence>
          </div>
          
          {isLogin && (
            <div className="mt-8 text-center">
              <button 
                className="text-xs font-mono text-white/40 hover:text-white transition-colors cursor-pointer"
                data-hover="true"
              >
                Lost your security code?
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;

