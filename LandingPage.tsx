/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { Ticket, Globe, Zap, Music, MapPin, Menu, X, Calendar, Play, ChevronLeft, ChevronRight, CheckCircle2, MessageSquare, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import FluidBackground from './components/FluidBackground';
import GradientText from './components/GlitchText';
import CustomCursor from './components/CustomCursor';
import ArtistCard from './components/ArtistCard';
import { Artist } from './types';

// Dummy Data
const FAQ_ITEMS = [
  {
    question: "What is TaskPulse?",
    answer: "TaskPulse is an AI-powered task management and productivity dashboard designed to help you organize your daily goals, track habits, and manage projects effectively with tools like Deep Focus Mode."
  },
  {
    question: "How does the AI task prioritization work?",
    answer: "The integrated AI analyzes your tasks based on due dates, importance, and historical completion patterns to automatically suggest which tasks you should tackle first."
  },
  {
    question: "Is my data synced across devices?",
    answer: "Yes! TaskPulse uses cloud synchronization so you can access your tasks, habits, and bento dashboard from any device securely."
  },
  {
    question: "What is Deep Focus Mode?",
    answer: "Deep Focus Mode provides a distraction-free environment with a built-in timer, task checklist, and immersive background lo-fi beats to help you concentrate on a single task."
  }
];

const FEATURES = [
  { 
    id: '1', 
    name: 'AI Prioritization', 
    genre: 'Intelligent Sorting', 
    day: 'Core', 
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop',
    description: 'AI ranks your tasks by urgency, importance, and your personal history to tell you exactly what matters most.'
  },
  { 
    id: '2', 
    name: 'Smart Scheduling', 
    genre: 'Auto-planning', 
    day: 'Core', 
    image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=1000&auto=format&fit=crop',
    description: 'Auto-generates a daily plan with time blocks, adapting to real-world interruptions and finding hidden open blocks.'
  },
  { 
    id: '3', 
    name: 'Proactive Nudges', 
    genre: 'Context-Aware', 
    day: 'Core', 
    image: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=1000&auto=format&fit=crop',
    description: 'Context-aware reminders triggered by AI when you are most likely to take meaningful action, replacing passive pings.'
  },
  { 
    id: '4', 
    name: 'Daily Focus', 
    genre: 'Single-Screen', 
    day: 'View', 
    image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=1000&auto=format&fit=crop',
    description: 'A single-screen "what to do right now" card that cuts through the noise and presents the single most important action.'
  },
  { 
    id: '5', 
    name: 'Goal Decomposition', 
    genre: 'Actionable Steps', 
    day: 'AI Tool', 
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000&auto=format&fit=crop',
    description: 'Breaks large, ambiguous goals into highly specific, actionable sub-tasks so you never wonder where to start.'
  },
  { 
    id: '6', 
    name: 'Deadline Tracking', 
    genre: 'Visual Urgency', 
    day: 'Tracker', 
    image: 'https://images.unsplash.com/photo-1501139083538-0139583c060f?q=80&w=1000&auto=format&fit=crop',
    description: 'Visual urgency indicators, color-coded by risk level, making sure you get ahead of deadlines before they become crises.'
  },
];

const App: React.FC = () => {
  const navigate = useNavigate();
  const { scrollYProgress, scrollY } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  
  const [feedback, setFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle'|'submitting'|'success'|'error'>('idle');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [isNavVisible, setIsNavVisible] = useState(true);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest < 50) {
      setIsNavVisible(true);
    } else if (latest > previous) {
      // scroll down -> vanish
      setIsNavVisible(false);
    } else {
      // scroll up -> visible
      setIsNavVisible(true);
    }
  });

  // Handle keyboard navigation for artist modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedArtist) return;
      if (e.key === 'ArrowLeft') navigateArtist('prev');
      if (e.key === 'ArrowRight') navigateArtist('next');
      if (e.key === 'Escape') setSelectedArtist(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArtist]);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setFeedbackStatus('submitting');
    try {
      await addDoc(collection(db, 'feedback'), {
        content: feedback,
        createdAt: new Date().toISOString()
      });
      setFeedbackStatus('success');
      setFeedback('');
      setTimeout(() => setFeedbackStatus('idle'), 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setFeedbackStatus('error');
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const navigateArtist = (direction: 'next' | 'prev') => {
    if (!selectedArtist) return;
    const currentIndex = FEATURES.findIndex(a => a.id === selectedArtist.id);
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % FEATURES.length;
    } else {
      nextIndex = (currentIndex - 1 + FEATURES.length) % FEATURES.length;
    }
    setSelectedArtist(FEATURES[nextIndex]);
  };
  
  return (
    <div className="relative min-h-screen text-white selection:bg-[#4fb7b3] selection:text-black cursor-auto md:cursor-none overflow-x-hidden">
      <CustomCursor />
      <FluidBackground />
      
      {/* Navigation */}
      <AnimatePresence>
        {isNavVisible && (
          <motion.nav 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 md:px-8 py-6 mix-blend-difference"
          >
            <div className="font-heading text-xl md:text-2xl font-bold tracking-tighter text-white cursor-default z-50">TASKPULSE</div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex gap-10 text-sm font-bold tracking-widest uppercase items-center">
              {['Features', 'Vision', 'FAQ', 'Feedback'].map((item) => (
                <button 
                  key={item} 
                  onClick={() => scrollToSection(item.toLowerCase().replace(/\s+/g, '-'))}
                  className="hover:text-[#a8fbd3] transition-colors text-white cursor-pointer bg-transparent border-none"
                  data-hover="true"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link 
                to="/auth" 
                className="text-xs font-bold tracking-widest uppercase hover:text-[#a8fbd3] transition-colors text-white cursor-pointer"
                data-hover="true"
              >
                Sign In
              </Link>
              <button 
                onClick={() => navigate('/auth')}
                className="border border-white px-8 py-3 text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 text-white cursor-pointer bg-transparent"
                data-hover="true"
              >
                Login
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-white z-50 relative w-10 h-10 flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
               {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-30 bg-[#31326f]/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 md:hidden"
          >
            {['Features', 'Vision', 'FAQ', 'Feedback'].map((item) => (
              <button
                key={item}
                onClick={() => { setMobileMenuOpen(false); scrollToSection(item.toLowerCase().replace(/\s+/g, '-')); }}
                className="text-4xl font-heading font-bold text-white hover:text-[#a8fbd3] transition-colors uppercase bg-transparent border-none"
              >
                {item}
              </button>
            ))}

            <Link 
              to="/auth"
              className="mt-4 text-2xl font-heading font-bold text-[#4fb7b3] hover:text-[#a8fbd3] transition-colors uppercase"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>

            <button 
              onClick={() => { setMobileMenuOpen(false); navigate('/auth'); }}
              className="mt-4 border border-white px-10 py-4 text-sm font-bold tracking-widest uppercase bg-white text-black"
            >
              Login
            </button>
            
            <div className="absolute bottom-10 flex gap-6">
               <a href="https://x.com/GoogleAIStudio" className="text-white/50 hover:text-white transition-colors">Twitter</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO SECTION */}
      <header className="relative h-[100svh] min-h-[600px] flex flex-col items-center justify-center overflow-hidden px-4">
        {/* Parallax Background Images */}
        <motion.div 
          className="absolute inset-0 w-full h-[130%] -z-10"
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, 250]) }}
        >
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop')] bg-cover bg-center opacity-30 mix-blend-screen" />
        </motion.div>
        
        <motion.div 
          className="absolute inset-0 w-full h-[150%] -z-10"
          style={{ y: useTransform(scrollYProgress, [0, 1], [0, 100]) }}
        >
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2560&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
        </motion.div>

        <motion.div 
          style={{ y, opacity }}
          className="z-10 text-center flex flex-col items-center w-full max-w-6xl pb-24 md:pb-20"
        >
           {/* Date / Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="flex items-center gap-3 md:gap-6 text-xs md:text-base font-mono text-[#a8fbd3] tracking-[0.2em] md:tracking-[0.3em] uppercase mb-4 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm"
          >
            <span>AI Task Manager</span>
          </motion.div>

          {/* Main Title */}
          <div className="relative w-full flex justify-center items-center">
            <GradientText 
              text="TASKPULSE" 
              as="h1" 
              className="text-[12vw] md:text-[11vw] leading-[0.9] font-black tracking-tighter text-center" 
            />
            {/* Optimized Orb - Reduced Blur for Performance */}
            <motion.div 
               className="absolute -z-20 w-[50vw] h-[50vw] bg-white/5 blur-[40px] rounded-full pointer-events-none will-change-transform"
               animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.6, 0.3] }}
               transition={{ duration: 6, repeat: Infinity }}
               style={{ transform: 'translateZ(0)' }}
            />
          </div>
          
          <motion.div
             initial={{ scaleX: 0 }}
             animate={{ scaleX: 1 }}
             transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
             className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mt-4 md:mt-8 mb-6 md:mb-8"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="text-base md:text-2xl font-light max-w-xl mx-auto text-white/90 leading-relaxed drop-shadow-lg px-4"
          >
            The Last-Minute Life Saver
          </motion.p>
        </motion.div>

        {/* MARQUEE - SLOWED DOWN for Performance & Aesthetics */}
        <div className="absolute bottom-12 md:bottom-16 left-0 w-full py-4 md:py-6 bg-white text-black z-20 overflow-hidden border-y-4 border-black shadow-[0_0_40px_rgba(255,255,255,0.4)]">
          <motion.div 
            className="flex w-fit will-change-transform"
            animate={{ x: "-50%" }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          >
            {/* Duplicate content for seamless loop */}
            {[0, 1].map((key) => (
              <div key={key} className="flex whitespace-nowrap shrink-0">
                {[...Array(4)].map((_, i) => (
                  <span key={i} className="text-3xl md:text-7xl font-heading font-black px-8 flex items-center gap-4">
                    TASKPULSE <span className="text-black text-2xl md:text-4xl">●</span> 
                    AUTONOMOUS PRODUCTIVITY <span className="text-black text-2xl md:text-4xl">●</span> 
                  </span>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* FEATURES SECTION */}
      <section id="features" className="relative z-10 py-20 md:py-32">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 md:mb-16 px-4">
             <h2 className="text-5xl md:text-8xl font-heading font-bold uppercase leading-[0.9] drop-shadow-lg break-words w-full md:w-auto">
              Key <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a8fbd3] to-[#4fb7b3]">Features</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/10 bg-black/20 backdrop-blur-sm">
            {FEATURES.map((feature) => (
              <ArtistCard key={feature.id} artist={feature} onClick={() => setSelectedArtist(feature)} />
            ))}
          </div>
        </div>
      </section>

      {/* EXPERIENCE SECTION */}
      <section id="vision" className="relative z-10 py-20 md:py-32 bg-black/20 backdrop-blur-sm border-t border-white/10 overflow-hidden">
        {/* Decorative blurred circle - Optimized */}
        <div className="absolute top-1/2 right-[-20%] w-[50vw] h-[50vw] bg-[#4fb7b3]/20 rounded-full blur-[40px] pointer-events-none will-change-transform" style={{ transform: 'translateZ(0)' }} />

        <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-16 items-center">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <h2 className="text-4xl md:text-7xl font-heading font-bold mb-6 md:mb-8 leading-tight">
                Beyond <br/> <GradientText text="PRODUCTIVITY" className="text-5xl md:text-8xl" />
              </h2>
              <p className="text-lg md:text-xl text-gray-200 mb-8 md:mb-12 font-light leading-relaxed drop-shadow-md">
                TaskPulse isn't just a to-do list; it's an intelligent companion. We fuse cutting-edge AI with seamless scheduling to create a living, breathing ecosystem for your tasks.
              </p>
              
              <div className="space-y-6 md:space-y-8">
                {[
                  { icon: CheckCircle2, title: 'Smart Task Management', desc: 'Automatically sort tasks by priority, duration, and energy levels.' },
                  { icon: Calendar, title: 'Dynamic Scheduling', desc: 'Intelligently allocate tasks into your free time slots.' },
                  { icon: MessageSquare, title: 'AI Companion', desc: 'Chat with TaskPulse for personalized productivity advice.' },
                ].map((feature, i) => (
                  <div
                    key={i} 
                    className="flex items-start gap-6"
                  >
                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/5">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg md:text-xl font-bold mb-1 md:mb-2 font-heading">{feature.title}</h4>
                      <p className="text-sm text-gray-300">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 relative h-[400px] md:h-[700px] w-full order-1 lg:order-2">
              <div className="absolute inset-0 bg-gradient-to-br from-[#637ab9] to-[#4fb7b3] rounded-3xl rotate-3 opacity-30 blur-xl" />
              <div className="relative h-full w-full rounded-3xl overflow-hidden border border-white/10 group shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000&auto=format&fit=crop" 
                  alt="Workspace" 
                  className="h-full w-full object-cover transition-transform duration-[1.5s] group-hover:scale-110 will-change-transform" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                
                <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10">
                  <div className="text-5xl md:text-8xl font-heading font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/0 opacity-50">
                    04
                  </div>
                  <div className="text-lg md:text-xl font-bold tracking-widest uppercase mt-2 text-white">
                    Key Capabilities
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="relative z-10 py-20 md:py-32 bg-black/40 backdrop-blur-md border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-7xl font-heading font-bold mb-4">
              Event <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a8fbd3] to-[#4fb7b3]">Logistics</span>
            </h2>
            <p className="text-gray-300 font-mono text-sm md:text-base tracking-widest uppercase">Everything you need to know about the TaskPulse Launch Event</p>
          </div>
          
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, index) => (
              <div 
                key={index} 
                className="border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm overflow-hidden transition-colors hover:bg-white/10"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-heading text-lg md:text-xl font-bold">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-[#4fb7b3]" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-white/50" />
                  )}
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 text-gray-300 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEEDBACK SECTION */}
      <section id="feedback" className="relative z-10 py-20 md:py-32 px-4 md:px-6 bg-black/30 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-20">
             <h2 className="text-5xl md:text-9xl font-heading font-bold opacity-20 text-white">
               FEEDBACK
             </h2>
             <p className="text-[#a8fbd3] font-mono uppercase tracking-widest -mt-3 md:-mt-8 relative z-10 text-sm md:text-base">
               We value your thoughts
             </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 backdrop-blur-md p-8 md:p-12">
            <form onSubmit={submitFeedback} className="flex flex-col gap-6">
              <div>
                <label htmlFor="feedback" className="block text-sm font-bold uppercase tracking-widest text-white/70 mb-4">
                  Share your experience or suggestions
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 p-4 text-white placeholder-white/30 focus:outline-none focus:border-[#4fb7b3] transition-colors min-h-[150px] resize-y"
                  placeholder="What do you think about TaskPulse?"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={feedbackStatus === 'submitting' || feedbackStatus === 'success'}
                className={`w-full md:w-auto self-end py-4 px-10 text-sm font-bold uppercase tracking-[0.2em] border border-white/20 transition-all duration-300 relative overflow-hidden group
                  ${feedbackStatus === 'success' 
                    ? 'bg-[#a8fbd3] text-black border-[#a8fbd3]' 
                    : feedbackStatus === 'submitting'
                      ? 'bg-white/20 text-white cursor-wait'
                      : 'text-white hover:bg-white hover:text-black cursor-pointer'
                  }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {feedbackStatus === 'submitting' ? 'Submitting...' : 
                   feedbackStatus === 'success' ? <><CheckCircle2 className="w-5 h-5" /> Received</> : 
                   'Send Feedback'}
                </span>
                {feedbackStatus === 'idle' && (
                  <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out -z-0" />
                )}
              </button>
              {feedbackStatus === 'error' && (
                <p className="text-red-400 text-sm text-right mt-2">Failed to submit feedback. Please try again.</p>
              )}
            </form>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-12 md:py-16 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div>
             <div className="font-heading text-3xl md:text-4xl font-bold tracking-tighter mb-4 text-white">TASKPULSE</div>
             <div className="flex gap-2 text-xs font-mono text-gray-400">
               <span>created by sandeep kumar</span>
             </div>
          </div>
          
          <div className="flex gap-6 md:gap-8 flex-wrap">
            <a href="https://x.com/GoogleAIStudio" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white font-bold uppercase text-xs tracking-widest transition-colors cursor-pointer" data-hover="true">
              Twitter
            </a>
          </div>
        </div>
      </footer>

      {/* Artist Detail Modal */}
      <AnimatePresence>
        {selectedArtist && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedArtist(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md cursor-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl bg-[#1a1b3b] border border-white/10 overflow-hidden flex flex-col md:flex-row shadow-2xl shadow-[#4fb7b3]/10 group/modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedArtist(null)}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-white hover:text-black transition-colors"
                data-hover="true"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Navigation Buttons */}
              <button
                onClick={(e) => { e.stopPropagation(); navigateArtist('prev'); }}
                className="absolute left-4 bottom-4 translate-y-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2 z-20 p-3 rounded-full bg-black/50 text-white hover:bg-white hover:text-black transition-colors border border-white/10 backdrop-blur-sm"
                data-hover="true"
                aria-label="Previous Artist"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); navigateArtist('next'); }}
                className="absolute right-4 bottom-4 translate-y-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2 z-20 p-3 rounded-full bg-black/50 text-white hover:bg-white hover:text-black transition-colors border border-white/10 backdrop-blur-sm md:right-8"
                data-hover="true"
                aria-label="Next Artist"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Image Side */}
              <div className="w-full md:w-1/2 h-64 md:h-auto relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={selectedArtist.id}
                    src={selectedArtist.image} 
                    alt={selectedArtist.name} 
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b3b] via-transparent to-transparent md:bg-gradient-to-r" />
              </div>

              {/* Content Side */}
              <div className="w-full md:w-1/2 p-8 pb-24 md:p-12 flex flex-col justify-center relative">
                <motion.div
                  key={selectedArtist.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <div className="flex items-center gap-3 text-[#4fb7b3] mb-4">
                     <Calendar className="w-4 h-4" />
                     <span className="font-mono text-sm tracking-widest uppercase">{selectedArtist.day}</span>
                  </div>
                  
                  <h3 className="text-4xl md:text-6xl font-heading font-bold uppercase leading-none mb-2 text-white">
                    {selectedArtist.name}
                  </h3>
                  
                  <p className="text-lg text-[#a8fbd3] font-medium tracking-widest uppercase mb-6">
                    {selectedArtist.genre}
                  </p>
                  
                  <div className="h-px w-20 bg-white/20 mb-6" />
                  
                  <p className="text-gray-300 leading-relaxed text-lg font-light mb-8">
                    {selectedArtist.description}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;