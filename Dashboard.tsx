import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, CheckCircle2, Clock, Calendar, 
  AlertTriangle, Brain, Trash2, Maximize2,
  Mic, Target, TrendingUp, BellRing, Lightbulb, Zap, CalendarDays, Search, X, RotateCcw, GripHorizontal, LogOut, User, Sun, Moon, Monitor, Sparkles, ChevronLeft, ChevronRight, BarChart2, AlignLeft, RefreshCw, Volume2, VolumeX, CheckSquare, Square
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, SubTask, Habit } from './types';
import { sortTasksIntelligently } from './utils/taskScoring';
import { calculateAvailableGaps, assignTasksToSlots, TimeSlot, generateItineraryPrompt } from './utils/scheduling';
import { Chatbot } from './components/Chatbot';
import FluidBackground from './components/FluidBackground';
import GradientText from './components/GlitchText';
import TaskMapContext from './components/TaskMapContext';
import { useAuth } from './contexts/AuthContext';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, writeBatch, updateDoc, deleteField } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { messaging } from './firebase';

// Mock Tasks initially
const INITIAL_MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Prep for Technical Interview',
    deadline: new Date(Date.now() + 86400000).toISOString(),
    priority: 'CRITICAL',
    estimatedDuration: 120,
    subTasks: ['Review React hooks', 'Practice algorithms', 'Draft introduction'],
    status: 'pending'
  },
  {
    id: 't2',
    title: 'Pay electric bill',
    deadline: new Date(Date.now() + 43200000).toISOString(),
    priority: 'HIGH',
    estimatedDuration: 10,
    subTasks: [],
    status: 'pending'
  }
];

const MOCK_TASKS = sortTasksIntelligently(INITIAL_MOCK_TASKS);



function SortableGridItem({ id, className, children, index = 0 }: { key?: React.Key, id: string, className: string, children: React.ReactNode, index?: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <section ref={setNodeRef} style={style} className={className}>
      <div {...attributes} {...listeners} className="absolute top-4 right-4 z-20 cursor-grab active:cursor-grabbing p-2 text-white/30 hover:text-white bg-black/20 hover:bg-white/10 rounded-lg transition-colors">
         <GripHorizontal className="w-4 h-4" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1, type: "spring", bounce: 0.2 }}
        className="w-full h-full flex flex-col relative z-10"
      >
        {children}
      </motion.div>
    </section>
  );
}

export type ToastType = 'success' | 'info' | 'error';
export type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

export const showToast = (message: string, type: ToastType = 'success') => {
  const event = new CustomEvent('show-toast', { 
    detail: { id: Math.random().toString(36).substring(7), message, type } 
  });
  window.dispatchEvent(event);
};

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastMessage>;
      const toast = customEvent.detail;
      setToasts(t => [...t, toast]);
      setTimeout(() => {
        setToasts(t => t.filter(x => x.id !== toast.id));
      }, 3000);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl ${
              toast.type === 'success' ? 'bg-[#4fb7b3]/20 border-[#4fb7b3]/40 text-[#a8fbd3]' : 
              toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-200' :
              'bg-white/10 border-white/20 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}
            {toast.type === 'info' && <BellRing className="w-5 h-5" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function UserProfileCard({ user, tasks, globalStreak, notificationsCount, onOpenSettings, onOpenNotifications, onLogout }: { user: any, tasks: Task[], globalStreak: number, notificationsCount: number, onOpenSettings: () => void, onOpenNotifications: () => void, onLogout: () => void }) {
  return (
    <div className="mt-auto pt-6 pb-6 lg:pb-0">
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.36)] group hover:border-[#a8fbd3]/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4fb7b3] to-[#a8fbd3] p-[2px] shrink-0">
            <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden">
              <User className="w-5 h-5 text-[#a8fbd3]" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold text-white truncate">{user?.displayName || 'User'}</div>
            <div className="text-[10px] font-mono text-white/50 truncate">{user?.email || 'user@taskpulse.com'}</div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white/5 rounded-lg border border-white/5">
            <div className="flex items-center gap-1.5">
               <Zap className="w-3.5 h-3.5 text-[#a8fbd3]" />
               <span className="text-xs font-mono text-white/70">Streak</span>
            </div>
            <span className="text-xs font-bold text-[#a8fbd3]">{globalStreak} Days</span>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-white/5 rounded-lg border border-white/5">
            <div className="flex items-center gap-1.5">
               <CheckCircle2 className="w-3.5 h-3.5 text-[#4fb7b3]" />
               <span className="text-xs font-mono text-white/70">Completed</span>
            </div>
            <span className="text-xs font-bold text-[#4fb7b3]">{tasks.filter(t => t.status === 'completed').length} Tasks</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onOpenSettings} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
            <Target className="w-3.5 h-3.5" />
            Settings
          </button>
          <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 border border-transparent transition-all">
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProfileDropdown({ user, tasks, globalStreak, notificationsCount, onOpenSettings, onOpenNotifications, onLogout, googleAccessToken, onConnectCalendar }: { user: any, tasks: Task[], globalStreak: number, notificationsCount: number, onOpenSettings: () => void, onOpenNotifications: () => void, onLogout: () => void, googleAccessToken: string | null, onConnectCalendar: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('taskpulse_theme') as any) || 'dark';
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('taskpulse_theme', theme);
    const isLight = theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isLight) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#a8fbd3]/50 border border-white/10 relative"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4fb7b3] to-[#a8fbd3] p-[2px] shrink-0">
          <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden">
            <User className="w-4 h-4 text-[#a8fbd3]" />
          </div>
        </div>
        {notificationsCount > 0 && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-[#a8fbd3] rounded-full border-2 border-black" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-3 w-72 origin-top-right bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-50 flex flex-col group/dropdown"
          >
            {/* Glassmorphism accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#4fb7b3]/20 blur-[50px] -z-10 rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#a8fbd3]/10 blur-[40px] -z-10 rounded-full pointer-events-none" />
            
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#4fb7b3] to-[#a8fbd3] p-[2px] shrink-0 shadow-[0_0_15px_rgba(79,183,179,0.3)]">
                  <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden">
                     <User className="w-6 h-6 text-[#a8fbd3]" />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-lg font-bold text-white truncate font-heading tracking-tight">{user?.displayName || 'User'}</div>
                  <div className="text-xs font-mono text-white/50 truncate mt-0.5">{user?.email || 'user@taskpulse.com'}</div>
                </div>
              </div>
              
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                  <div className="flex items-center gap-2.5">
                     <Zap className="w-4 h-4 text-[#a8fbd3]" />
                     <span className="text-xs font-mono text-white/70">Focus Streak</span>
                  </div>
                  <span className="text-xs font-bold text-[#a8fbd3]">{globalStreak} Days</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                  <div className="flex items-center gap-2.5">
                     <CheckCircle2 className="w-4 h-4 text-[#4fb7b3]" />
                     <span className="text-xs font-mono text-white/70">Completed</span>
                  </div>
                  <span className="text-xs font-bold text-[#4fb7b3]">{tasks.filter(t => t.status === 'completed').length} Tasks</span>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              {!googleAccessToken ? (
                <button onClick={() => { onConnectCalendar(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                  <Calendar className="w-4 h-4 text-white/50" />
                  Connect Google Calendar
                </button>
              ) : (
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-[#a8fbd3] bg-[#a8fbd3]/5 transition-colors">
                  <Calendar className="w-4 h-4 text-[#a8fbd3]" />
                  Google Calendar Connected
                </div>
              )}
              <button onClick={() => { onOpenSettings(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <Target className="w-4 h-4 text-white/50" />
                Account Settings
              </button>
              <button onClick={() => { onOpenNotifications(); setIsOpen(false); }} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <BellRing className="w-4 h-4 text-white/50" />
                  Notifications
                </div>
                {notificationsCount > 0 && (
                  <span className="bg-[#4fb7b3] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {notificationsCount}
                  </span>
                )}
              </button>
            </div>

            <div className="p-2 space-y-1 border-t border-white/10">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-mono text-white/50 uppercase tracking-wider">Theme</span>
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                  <button 
                    onClick={() => { setTheme('light'); showToast('Light theme applied'); }}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'light' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                    title="Light Theme"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => { setTheme('dark'); showToast('Dark theme applied'); }}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                    title="Dark Theme"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => { setTheme('system'); showToast('System theme applied'); }}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'}`}
                    title="System Theme"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-2 border-t border-white/10">
              <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors">
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImmersiveFocusMode({ task, onClose, onComplete }: { task: Task, onClose: () => void, onComplete: () => void }) {
  const totalDuration = task.estimatedDuration ? task.estimatedDuration * 60 : 25 * 60;
  const [timeLeft, setTimeLeft] = useState(totalDuration);
  const [isActive, setIsActive] = useState(true);
  const [completedSubTasks, setCompletedSubTasks] = useState<number[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = timeLeft / totalDuration;
  const radius = 160;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  const toggleSubTask = (index: number) => {
    setCompletedSubTasks(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-[#0a0a0a] flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-zinc-900 to-black" />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-emerald-900/20 blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-indigo-900/20 blur-[100px]"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center justify-center max-w-2xl w-full p-4 sm:p-8 text-center h-full max-h-screen overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-4 right-4 sm:top-8 sm:right-8 p-4 text-white/50 hover:text-white transition-colors bg-black/40 rounded-full backdrop-blur-md z-50">
          <X className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>

        <div className="space-y-4 w-full mt-16 sm:mt-0">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            Deep Focus
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-lg px-4">{task.title}</h2>
        </div>

        <div className="relative flex items-center justify-center my-12 sm:my-16 group">
          <svg className="absolute w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] -rotate-90 pointer-events-none transition-all duration-500 opacity-30 group-hover:opacity-100" viewBox="0 0 400 400">
            <circle
              cx="200"
              cy="200"
              r={radius}
              className="fill-none stroke-white/10"
              strokeWidth="4"
            />
            <circle
              cx="200"
              cy="200"
              r={radius}
              className="fill-none stroke-emerald-400 transition-all duration-1000 ease-linear"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>

          <div className="text-[5rem] sm:text-[7rem] md:text-[9rem] font-mono font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 tracking-tighter tabular-nums drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 w-full">
          <button onClick={toggleTimer} className="p-5 sm:p-6 rounded-full bg-white text-black hover:bg-gray-200 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95">
            {isActive ? <span className="block w-5 h-5 sm:w-6 sm:h-6 bg-black rounded-sm" /> : <svg className="w-5 h-5 sm:w-6 sm:h-6 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </button>
          
          <button onClick={onComplete} className="px-6 sm:px-8 py-4 sm:py-5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black transition-all duration-300 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 sm:gap-3 backdrop-blur-md hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            Complete Task
          </button>
        </div>

        {task.subTasks && task.subTasks.length > 0 && (
          <div className="mt-8 sm:mt-12 text-left w-full max-w-md bg-black/40 border border-white/10 p-5 sm:p-6 rounded-2xl backdrop-blur-xl transition-all hover:bg-black/60 hover:border-white/20">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-mono uppercase tracking-widest text-emerald-400">Task Checklist</h3>
               <span className="text-[10px] font-mono text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                 {completedSubTasks.length}/{task.subTasks.length}
               </span>
             </div>
             
             <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
               <div 
                 className="h-full bg-emerald-400 transition-all duration-500"
                 style={{ width: `${(completedSubTasks.length / task.subTasks.length) * 100}%` }}
               />
             </div>

             <ul className="space-y-2">
               {task.subTasks.map((st, i) => {
                 const isCompleted = completedSubTasks.includes(i);
                 return (
                   <li 
                     key={i} 
                     onClick={() => toggleSubTask(i)}
                     className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                       isCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-white/40' : 'bg-white/5 border-transparent text-white/80 hover:bg-white/10'
                     }`}
                   >
                     <div className="mt-0.5 shrink-0 text-emerald-400 transition-colors">
                       {isCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-50" />}
                     </div>
                     <span className={`text-sm transition-all duration-200 ${isCompleted ? 'line-through opacity-70' : ''}`}>{st}</span>
                   </li>
                 );
               })}
             </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateStreak = (completedDays: string[]) => {
  let streak = 0;
  let d = new Date();
  let currentDateStr = formatDate(d);
  
  if (!completedDays.includes(currentDateStr)) {
      d.setDate(d.getDate() - 1);
      currentDateStr = formatDate(d);
  }
  
  while(completedDays.includes(currentDateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
      currentDateStr = formatDate(d);
  }
  return streak;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, googleAccessToken, signInWithGoogle, logout } = useAuth();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    const qTasks = query(collection(db, 'users', user.uid, 'tasks'));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const loadedTasks = snap.docs.map(d => d.data() as Task);
      setTasks(sortTasksIntelligently(loadedTasks));
      setIsLoadingData(false);
    });

    const qHabits = query(collection(db, 'users', user.uid, 'habits'));
    const unsubHabits = onSnapshot(qHabits, (snap) => {
      setHabits(snap.docs.map(d => d.data() as Habit));
    });

    const qEvents = query(collection(db, 'users', user.uid, 'events'));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      const loadedEvents = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          start: data.start ? new Date(data.start) : new Date(),
          end: data.end ? new Date(data.end) : new Date(),
        } as any;
      });
      setCustomEvents(loadedEvents);
    });

    return () => {
      unsubTasks();
      unsubHabits();
      unsubEvents();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const handleEnablePushNotifications = async () => {
    if (!messaging) {
      showToast('Push notifications are not supported in this browser.', 'error');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: 'BH1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmno' // Note: This should ideally be your real VAPID key from Firebase Console
        }).catch(err => {
           console.log("Error with VAPID key, trying without", err);
           return getToken(messaging); 
        });

        if (token && user) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: token
          }).catch(async (e) => {
             // If doc doesn't exist yet, use setDoc
             await setDoc(doc(db, 'users', user.uid), { fcmToken: token }, { merge: true });
          });
          showToast('Push notifications enabled!');
        } else {
          showToast('Failed to generate notification token.', 'error');
        }
      } else {
        showToast('Notification permission denied.', 'error');
      }
    } catch (error) {
      console.error('Error getting notification token:', error);
      showToast('An error occurred. Make sure VAPID key is configured.', 'error');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'search' | 'ai'>('ai');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<Task[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);
  
  const [upNextFilter, setUpNextFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [upNextSort, setUpNextSort] = useState<'default' | 'priority-desc' | 'priority-asc'>('default');
  
  type NudgeStatus = 'idle' | 'running' | 'finished';
  type Nudge = {
    id: string;
    title: string;
    time: string;
    type: string;
    actionLabel?: string;
    status: NudgeStatus;
    timerSeconds: number;
  };

  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissedNudgeIds, setDismissedNudgeIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (tasks.length === 0) return;
    
    setNudges(prev => {
      const newNudges = [...prev];
      
      // 1. Critical Tasks Due Today or Overdue
      const now = new Date();
      const criticalTasks = tasks.filter(t => t.status === 'pending' && (t.priority === 'CRITICAL' || t.priority === 'HIGH'));
      
      criticalTasks.forEach(t => {
        const deadlineDate = new Date(t.deadline);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        let timeText = 'Upcoming';
        let type = 'suggestion';
        if (diffDays <= 0) {
           timeText = 'Overdue';
           type = 'urgent';
        } else if (diffDays === 1) {
           timeText = 'Due Today';
           type = 'urgent';
        } else {
           timeText = `Due in ${diffDays} days`;
        }
        
        const nudgeId = `task-urgent-${t.id}`;
        if (!newNudges.some(n => n.id === nudgeId) && !dismissedNudgeIds.includes(nudgeId) && type === 'urgent') {
          newNudges.push({
            id: nudgeId,
            title: `Urgent: ${t.title}`,
            time: timeText,
            type: 'urgent',
            actionLabel: 'Focus Now',
            status: 'idle',
            timerSeconds: 0
          });
        }
      });
      
      // 2. Habit nudges
      if (habits.length > 0) {
        const todayStr = formatDate(now);
        const missedHabits = habits.filter(h => !h.completedDays || !h.completedDays.includes(todayStr));
        if (missedHabits.length > 0) {
           const nudgeId = `habit-missed-${todayStr}`;
           if (!newNudges.some(n => n.id === nudgeId) && !dismissedNudgeIds.includes(nudgeId)) {
             newNudges.push({
               id: nudgeId,
               title: `Don't break the streak! You have ${missedHabits.length} habits left for today.`,
               time: "Today",
               type: "suggestion",
               actionLabel: "Track Habits",
               status: 'idle',
               timerSeconds: 0
             });
           }
        }
      }
      
      // Keep only up to 4 nudges
      return newNudges.slice(0, 4);
    });
  }, [tasks, habits, dismissedNudgeIds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNudges(prev => prev.map(n => n.status === 'running' ? { ...n, timerSeconds: n.timerSeconds + 1 } : n));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const toggleNudgeTimer = (id: string) => {
    let finishedNudge: Nudge | undefined;
    setNudges(prev => prev.map(n => {
      if (n.id === id) {
        if (n.status === 'idle') return { ...n, status: 'running' };
        if (n.status === 'running') {
          finishedNudge = n;
          return { ...n, status: 'finished' };
        }
      }
      return n;
    }));
    if (finishedNudge) {
      showToast(`Finished: ${finishedNudge.title} in ${formatTimer(finishedNudge.timerSeconds)}`, 'success');
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const dismissNudge = (id: string) => {
    setNudges(prev => prev.filter(n => n.id !== id));
    setDismissedNudgeIds(prev => [...prev, id]);
  };
  
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [generatingStepsFor, setGeneratingStepsFor] = useState<string | null>(null);
  const [expandedStepsFor, setExpandedStepsFor] = useState<string | null>(null);

  const toggleTaskSteps = async (task: Task) => {
    if (expandedStepsFor === task.id) {
      setExpandedStepsFor(null);
    } else {
      setExpandedStepsFor(task.id);
      if (!task.subTasks || task.subTasks.length === 0) {
        await generateTaskSteps(task);
      }
    }
  };

  const generateTaskSteps = async (task: Task) => {
    if (!user) return;
    setGeneratingStepsFor(task.id);
    try {
      const response = await fetch('/api/how-to-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle: task.title })
      });
      const data = await response.json();
      if (data.steps && data.steps.length > 0) {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
          subTasks: data.steps
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingStepsFor(null);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.status === 'completed') return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = task.title.toLowerCase().includes(query) ||
          task.status.toLowerCase().includes(query) ||
          new Date(task.deadline).toLocaleDateString().toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (filterCategories.length > 0) {
        if (!task.category || !filterCategories.includes(task.category)) return false;
      }
      if (filterPriorities.length > 0) {
        const p = task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'High' : (task.priority === 'LOW' ? 'Low' : 'Medium');
        if (!filterPriorities.includes(p)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, filterCategories, filterPriorities]);

  const globalStreak = useMemo(() => {
    let streak = 0;
    let d = new Date();
    let currentDateStr = formatDate(d);
    
    const completedTaskDates = new Set(tasks.filter(t => t.status === 'completed' && t.completedAt).map(t => formatDate(new Date(t.completedAt as string))));
    
    if (!completedTaskDates.has(currentDateStr)) {
        d.setDate(d.getDate() - 1);
        currentDateStr = formatDate(d);
    }
    
    while(completedTaskDates.has(currentDateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
        currentDateStr = formatDate(d);
    }
    return streak;
  }, [tasks]);

  const productivityData = useMemo(() => {
    const data = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      const dateString = formatDate(d);
      const startOfDay = new Date(d);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23,59,59,999);
      
      const tasksOnDay = tasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= startOfDay && new Date(t.completedAt) <= endOfDay);
      
      const tasksDueOnDay = tasks.filter(t => t.deadline && new Date(t.deadline) >= startOfDay && new Date(t.deadline) <= endOfDay);
      
      const relevantTasks = Array.from(new Set([...tasksDueOnDay, ...tasksOnDay]));
      
      let completionRate = 0;
      if (relevantTasks.length > 0) {
        const completedRelevant = relevantTasks.filter(t => t.status === 'completed');
        completionRate = Math.round((completedRelevant.length / relevantTasks.length) * 100);
      }
      
      const focusTime = tasksOnDay.reduce((sum, t) => sum + (t.estimatedDuration || 30), 0);
      
      let habitConsistency = 0;
      if (habits.length > 0) {
        const completedHabits = habits.filter(h => h.completedDays && h.completedDays.includes(dateString));
        habitConsistency = Math.round((completedHabits.length / habits.length) * 100);
      }
      
      data.push({
        day: dayName,
        completionRate,
        focusTime,
        habitConsistency
      });
    }
    return data;
  }, [tasks, habits]);

  const productivityStats = useMemo(() => {
    if (productivityData.length === 0) return { avgCompletion: 0, totalFocusHours: 0, avgHabitConsistency: 0 };
    const avgCompletion = Math.round(productivityData.reduce((sum, d) => sum + d.completionRate, 0) / productivityData.length);
    const totalFocusHours = (productivityData.reduce((sum, d) => sum + d.focusTime, 0) / 60).toFixed(1);
    const avgHabitConsistency = Math.round(productivityData.reduce((sum, d) => sum + d.habitConsistency, 0) / productivityData.length);
    return { avgCompletion, totalFocusHours, avgHabitConsistency };
  }, [productivityData]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  useEffect(() => {
    if (googleAccessToken) {
      const fetchCalendarEvents = async () => {
        setIsLoadingCalendar(true);
        try {
          const timeMin = new Date().toISOString();
          const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // next 7 days
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setCalendarEvents(data.items || []);
          } else {
            console.error("Failed to fetch calendar events", await res.text());
          }
        } catch (e) {
          console.error("Error fetching calendar events", e);
        } finally {
          setIsLoadingCalendar(false);
        }
      };
      fetchCalendarEvents();
    } else {
      setCalendarEvents([]);
    }
  }, [googleAccessToken]);

  const [inputTask, setInputTask] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuccessSparkle, setShowSuccessSparkle] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        let finalTranscript = inputTask;
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setInputTask(finalTranscript + interimTranscript);
        };
        
        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === 'not-allowed') {
            showToast("Microphone access denied. Please check your browser settings.", "error");
          }
          setIsRecording(false);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
        };
        
        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } else {
        alert("Speech recognition is not supported in this browser.");
      }
    }
  };
  
  // Drag and Drop State for Bento Grid
  const [bentoOrder, setBentoOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('taskpulse_bento_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.includes('taskProgress')) {
          parsed.push('taskProgress');
        }
        if (!parsed.includes('calendar')) {
          parsed.push('calendar');
        }
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse bento order from local storage", e);
    }
    return ['quickAdd', 'upNext', 'nudges', 'calendar', 'recentActivity', 'taskProgress'];
  });
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setBentoOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('taskpulse_bento_order', JSON.stringify(newOrder));
        return newOrder;
      });
    }
  };
  
  // Typewriter effect for placeholder
  const [placeholderText, setPlaceholderText] = useState("");
  const placeholderExamples = useMemo(() => [
    "Type: 'Meeting with team tomorrow at 3pm'",
    "Type: 'Remind me to drink water'",
    "Type: 'Finish the Q3 report by Friday'",
    "Type: 'Call mom tonight'"
  ], []);

  useEffect(() => {
    let currentExampleIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeout: NodeJS.Timeout;

    const type = () => {
      const currentExample = placeholderExamples[currentExampleIndex];
      
      if (isDeleting) {
        setPlaceholderText(currentExample.substring(0, currentCharIndex - 1));
        currentCharIndex--;
      } else {
        setPlaceholderText(currentExample.substring(0, currentCharIndex + 1));
        currentCharIndex++;
      }

      if (!isDeleting && currentCharIndex === currentExample.length) {
        timeout = setTimeout(() => {
          isDeleting = true;
          type();
        }, 2000);
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false;
        currentExampleIndex = (currentExampleIndex + 1) % placeholderExamples.length;
        timeout = setTimeout(type, 500);
      } else {
        timeout = setTimeout(type, isDeleting ? 30 : 60);
      }
    };

    timeout = setTimeout(type, 1000);
    return () => clearTimeout(timeout);
  }, [placeholderExamples]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputTask(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 56), 150)}px`;
    }
  };
  
  const [newHabitName, setNewHabitName] = useState('');

  const toggleHabit = (habitId: string, dateStr: string) => {
    if (!user) return;
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const isCompleted = habit.completedDays.includes(dateStr);
    let newCompletedDays = [...habit.completedDays];
    if (isCompleted) {
      newCompletedDays = newCompletedDays.filter(d => d !== dateStr);
    } else {
      newCompletedDays.push(dateStr);
    }
    
    const newStreak = calculateStreak(newCompletedDays);
    
    updateDoc(doc(db, 'users', user.uid, 'habits', habitId), {
      completedDays: newCompletedDays,
      streak: newStreak
    });
    showToast('Habit updated successfully');
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim() || !user) return;
    
    const newHabitId = Math.random().toString(36).substring(7);
    setDoc(doc(db, 'users', user.uid, 'habits', newHabitId), {
      id: newHabitId,
      name: newHabitName.trim(),
      streak: 0,
      completedDays: []
    });
    setNewHabitName('');
    showToast('New habit added');
  };

  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        dateStr: formatDate(d),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    return days;
  }, []);
  
  // Navigation State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'overview' | 'focus' | 'schedule' | 'backlog' | 'habits'>('overview');

  // Mock Data for new features
  const [insights, setInsights] = useState<string[]>([
    "Your focus drops after 2PM. Try shifting complex tasks to morning blocks.",
    "You have 3 back-to-back meetings tomorrow. Consider blocking 30 mins for prep."
  ]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const generateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, habits })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.insights && data.insights.length > 0) {
          setInsights(data.insights);
        }
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const [quickAddPriority, setQuickAddPriority] = useState<'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | null>(null);
  const [quickAddRecurring, setQuickAddRecurring] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none');
  const [quickAddDate, setQuickAddDate] = useState('');
  const [quickAddTime, setQuickAddTime] = useState('');

  const handleIngestTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputTask.trim() || !user) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputTask })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Failed to process task");
      }
      
      const data = await response.json();
      
      const newTaskId = data.taskId || Math.random().toString(36).substring(7);
      
      let scheduledStart = data.scheduledStart || undefined;
      if (quickAddDate && quickAddTime) {
        const [year, month, day] = quickAddDate.split('-').map(Number);
        const [hours, minutes] = quickAddTime.split(':').map(Number);
        scheduledStart = new Date(year, month - 1, day, hours, minutes).toISOString();
      } else if (quickAddDate) {
         const [year, month, day] = quickAddDate.split('-').map(Number);
         scheduledStart = new Date(year, month - 1, day, 9, 0).toISOString();
      }

      const newTask: Task = {
        id: newTaskId,
        title: inputTask,
        deadline: quickAddDate ? new Date(quickAddDate).toISOString() : (data.extractedDeadline || new Date(Date.now() + 86400000 * 2).toISOString()),
        priority: quickAddPriority || data.priorityLevel || 'MODERATE',
        subTasks: data.actionableSubTasks || [],
        status: 'pending',
        estimatedDuration: data.estimatedDuration || 30,
        recurring: quickAddRecurring,
        scheduledStart: scheduledStart || null,
        aiExplanation: data.aiExplanation || '',
        locationQuery: data.locationQuery || null
      };

      const cleanTask = Object.fromEntries(Object.entries(newTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, 'users', user.uid, 'tasks', newTaskId), cleanTask);
      
      if (googleAccessToken && scheduledStart) {
        try {
          const startTimeIso = new Date(scheduledStart).toISOString();
          const durationMinutes = newTask.estimatedDuration || 30;
          const endTimeIso = new Date(new Date(startTimeIso).getTime() + durationMinutes * 60000).toISOString();
          
          await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              summary: newTask.title,
              description: newTask.aiExplanation || '',
              start: {
                dateTime: startTimeIso,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              },
              end: {
                dateTime: endTimeIso,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            })
          });
        } catch (calError) {
          console.error("Failed to sync to Google Calendar", calError);
        }
      }
      
      showToast('Task added successfully');
      
      setShowSuccessSparkle(true);
      setTimeout(() => setShowSuccessSparkle(false), 2000);
      
      setInputTask('');
      setQuickAddPriority(null);
      setQuickAddRecurring('none');
      setQuickAddDate('');
      setQuickAddTime('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Invalid Gemini API Key") || error.message?.includes("API key not valid") || error.message?.includes("Groq")) {
         alert(error.message);
      }
      // Fallback
      const fallbackId = Math.random().toString(36).substring(7);
      
      let scheduledStart = undefined;
      if (quickAddDate && quickAddTime) {
        const [year, month, day] = quickAddDate.split('-').map(Number);
        const [hours, minutes] = quickAddTime.split(':').map(Number);
        scheduledStart = new Date(year, month - 1, day, hours, minutes).toISOString();
      } else if (quickAddDate) {
         const [year, month, day] = quickAddDate.split('-').map(Number);
         scheduledStart = new Date(year, month - 1, day, 9, 0).toISOString();
      }

      const fallbackTask: Task = {
        id: fallbackId,
        title: inputTask,
        deadline: quickAddDate ? new Date(quickAddDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        priority: quickAddPriority || 'MODERATE',
        subTasks: [],
        status: 'pending',
        recurring: quickAddRecurring,
        scheduledStart: scheduledStart || null
      };
      const cleanFallbackTask = Object.fromEntries(Object.entries(fallbackTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, 'users', user.uid, 'tasks', fallbackId), cleanFallbackTask);
      showToast('Task added (fallback mode)', 'info');
      
      setShowSuccessSparkle(true);
      setTimeout(() => setShowSuccessSparkle(false), 2000);
      
      setInputTask('');
      setQuickAddPriority(null);
      setQuickAddRecurring('none');
      setQuickAddDate('');
      setQuickAddTime('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiTaskSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsAiSearching(true);
    setAiSearchResults([]);
    setShowAiResults(true);

    try {
      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: searchQuery })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate tasks');
      }

      if (data.tasks && Array.isArray(data.tasks)) {
        const generatedTasks: Task[] = data.tasks.map((t: any) => ({
          id: Math.random().toString(36).substring(7),
          title: t.title,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          priority: t.priorityLevel || 'MODERATE',
          subTasks: t.actionableSubTasks || [],
          status: 'pending',
          estimatedDuration: t.estimatedDuration || 30
        }));
        setAiSearchResults(generatedTasks);
      }
    } catch (error: any) {
      console.error("Failed to generate AI tasks", error);
      showToast(error.message || 'Failed to generate tasks', 'error');
    } finally {
      setIsAiSearching(false);
    }
  };

  const addAiGeneratedTask = async (task: Task) => {
    if (!user) return;
    try {
      const newTask = {
        ...task,
        id: task.id || Math.random().toString(36).substring(7),
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
        userId: user.uid
      };
      
      const cleanTask = Object.fromEntries(Object.entries(newTask).filter(([_, v]) => v !== undefined));
      await setDoc(doc(db, 'users', user.uid, 'tasks', newTask.id), cleanTask);
      showToast('AI Task saved directly to your list', 'success');
    } catch (error: any) {
      console.error("Error saving AI task", error);
      showToast("Failed to save AI task", 'error');
    }
  };

  const completeTask = (id: string) => {
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'tasks', id), { 
      status: 'completed',
      completedAt: new Date().toISOString()
    });
    showToast('Task completed successfully');
  };

  const undoTask = (id: string) => {
    if (!user) return;
    updateDoc(doc(db, 'users', user.uid, 'tasks', id), { 
      status: 'pending',
      completedAt: deleteField()
    });
    showToast('Task restored', 'info');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'HIGH': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      default: return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    }
  };

  const focusTask = activeFocusTaskId ? tasks.find(t => t.id === activeFocusTaskId) : (filteredTasks.length > 0 ? filteredTasks[0] : null);

  const [isImmersiveMode, setIsImmersiveMode] = useState(false);

  const handleStartFocus = (taskId: string) => {
    setActiveFocusTaskId(taskId);
    setIsImmersiveMode(true);
    showToast('Entered Deep Focus Mode. Notifications disabled.', 'info');
  };

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: Brain, tooltip: 'Your daily pulse and high-level insights' },
    { id: 'focus', label: 'Deep Focus', icon: Maximize2, tooltip: 'Enter distraction-free work mode' },
    { id: 'schedule', label: 'Smart Schedule', icon: CalendarDays, tooltip: 'AI-powered daily itinerary' },
    { id: 'backlog', label: 'Prioritized Backlog', icon: AlertTriangle, tooltip: 'Manage and prioritize pending tasks' },
    { id: 'habits', label: 'Habits & Insights', icon: Target, tooltip: 'Track productivity trends and habits' },
  ];

  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const notifications = useMemo(() => {
    const notifs = [];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23,59,59,999);

    // Upcoming deadlines
    const upcomingTasks = tasks.filter(t => t.status === 'pending' && t.deadline && new Date(t.deadline) > now && new Date(t.deadline) <= tomorrow);
    upcomingTasks.forEach(task => {
      notifs.push({
        id: `deadline-${task.id}`,
        type: 'deadline',
        title: 'Upcoming Deadline',
        message: `"${task.title}" is due soon.`,
        time: new Date(task.deadline).getTime()
      });
    });

    // Daily goals
    const todayHighTasks = tasks.filter(t => t.priority === 'HIGH' && t.deadline && new Date(t.deadline) >= startOfDay && new Date(t.deadline) <= endOfDay);
    if (todayHighTasks.length > 0 && todayHighTasks.every(t => t.status === 'completed')) {
      notifs.push({
        id: 'daily-goal',
        type: 'goal',
        title: 'Daily Goal Met!',
        message: 'You completed all your high-priority tasks for today. Great job!',
        time: now.getTime()
      });
    }

    // Overdue tasks
    const overdueTasks = tasks.filter(t => t.status === 'pending' && t.deadline && new Date(t.deadline) < now);
    if (overdueTasks.length > 0) {
      notifs.push({
        id: 'overdue-tasks',
        type: 'alert',
        title: 'Overdue Tasks',
        message: `You have ${overdueTasks.length} overdue task(s). Keep it up!`,
        time: now.getTime() - 60000 // Just put it a minute ago
      });
    }

    notifs.sort((a, b) => b.time - a.time);
    return notifs;
  }, [tasks]);

  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => formatDate(new Date()));
  const [newEventStart, setNewEventStart] = useState('10:00');
  const [newEventEnd, setNewEventEnd] = useState('11:00');
  const [newEventCategory, setNewEventCategory] = useState('Logistics');
  const [newEventPriority, setNewEventPriority] = useState('Medium');
  const [newEventRecurring, setNewEventRecurring] = useState<'none' | 'daily' | 'weekly' | 'custom'>('none');
  
  const [planningResult, setPlanningResult] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'list' | 'gantt'>('list');
  const [tempGanttState, setTempGanttState] = useState<{ id: string, source: string, newStart: number, newEnd: number } | null>(null);
  const ganttContextRef = useRef({ duration: 0, minTime: 0 });
  const [scheduleDate, setScheduleDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  });

  const navigateSchedule = (direction: 'prev' | 'next') => {
    setScheduleDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
      return d;
    });
  };

  // AI Schedule Logic
  const [customEvents, setCustomEvents] = useState<{ id: string, title: string, start: Date, end: Date, category?: string, priority?: string, recurring?: 'none' | 'daily' | 'weekly' | 'custom' }[]>([]);
  const [selectedScheduleItems, setSelectedScheduleItems] = useState<{ id: string, source: string }[]>([]);
  
  const getEventsForDate = (date: Date) => {
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);

    return customEvents.map(ev => {
      if (ev.recurring === 'daily' && todayStart.getTime() >= new Date(ev.start).setHours(0,0,0,0)) {
        const start = new Date(todayStart);
        start.setHours(ev.start.getHours(), ev.start.getMinutes(), ev.start.getSeconds(), 0);
        const end = new Date(todayStart);
        end.setHours(ev.end.getHours(), ev.end.getMinutes(), ev.end.getSeconds(), 0);
        return { ...ev, start, end };
      }
      if (ev.recurring === 'weekly' && todayStart.getTime() >= new Date(ev.start).setHours(0,0,0,0) && todayStart.getDay() === ev.start.getDay()) {
        const start = new Date(todayStart);
        start.setHours(ev.start.getHours(), ev.start.getMinutes(), ev.start.getSeconds(), 0);
        const end = new Date(todayStart);
        end.setHours(ev.end.getHours(), ev.end.getMinutes(), ev.end.getSeconds(), 0);
        return { ...ev, start, end };
      }
      return ev;
    }).filter(ev => {
      if (ev.start < todayStart || ev.start > todayEnd) return false;
      if (filterCategories.length > 0) {
        if (!ev.category || !filterCategories.includes(ev.category)) return false;
      }
      if (filterPriorities.length > 0) {
        if (!ev.priority || !filterPriorities.includes(ev.priority)) return false;
      }
      return true;
    });
  };

  const generatedSchedule = useMemo(() => {
    const WORKING_HOURS = { start: '08:00', end: '22:00' };

    const todayStart = new Date(scheduleDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(scheduleDate);
    todayEnd.setHours(23, 59, 59, 999);

    const todaysEvents = getEventsForDate(scheduleDate);
    
    const todaysTasksWithFixedTime = filteredTasks.filter(t => t.status !== 'completed' && t.scheduledStart && new Date(t.scheduledStart) >= todayStart && new Date(t.scheduledStart) <= todayEnd);
    const todaysFixedTaskEvents = todaysTasksWithFixedTime.map(t => ({
      id: t.id,
      title: t.title,
      start: new Date(t.scheduledStart!),
      end: new Date(new Date(t.scheduledStart!).getTime() + (t.estimatedDuration || 30) * 60000),
      category: 'Task',
      priority: t.priority
    }));

    const allOccupiedSlots = [...todaysEvents, ...todaysFixedTaskEvents];
    const gaps = calculateAvailableGaps(allOccupiedSlots, WORKING_HOURS, scheduleDate);
    
    const tasksToAutoAssign = filteredTasks.filter(t => t.status !== 'completed' && !t.scheduledStart);
    const assignedBlocks = assignTasksToSlots(tasksToAutoAssign, gaps);

    // Merge for timeline display
    const timelineItems = [
      ...todaysEvents.map(slot => ({
        id: slot.id,
        source: 'event',
        time: slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: slot.start.getTime(),
        endTime: slot.end.getTime(),
        task: slot.title,
        type: 'calendar',
        category: slot.category,
        priority: slot.priority,
        recurring: (slot as any).recurring
      })),
      ...todaysTasksWithFixedTime.map(t => {
        const start = new Date(t.scheduledStart!);
        const end = new Date(start.getTime() + (t.estimatedDuration || 30) * 60000);
        return {
          id: t.id,
          source: 'task',
          time: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: start.getTime(),
          endTime: end.getTime(),
          task: t.title,
          type: 'active',
          priority: t.priority === 'CRITICAL' || t.priority === 'HIGH' ? 'High' : t.priority === 'LOW' ? 'Low' : 'Medium',
          recurring: t.recurring
        };
      }),
      ...assignedBlocks.map(block => ({
        id: block.task.id,
        source: 'task',
        time: block.slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: block.slot.start.getTime(),
        endTime: block.slot.end.getTime(),
        task: block.task.title,
        type: 'active',
        priority: block.task.priority === 'CRITICAL' || block.task.priority === 'HIGH' ? 'High' : block.task.priority === 'LOW' ? 'Low' : 'Medium',
        recurring: block.task.recurring
      }))
    ].sort((a, b) => a.timestamp - b.timestamp);

    return timelineItems;
  }, [filteredTasks, customEvents, scheduleDate]);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate || !newEventStart || !newEventEnd) return;
    
    const [year, month, day] = newEventDate.split('-').map(Number);
    const [startH, startM] = newEventStart.split(':').map(Number);
    const [endH, endM] = newEventEnd.split(':').map(Number);
    
    const startDate = new Date(year, month - 1, day, startH, startM);
    const endDate = new Date(year, month - 1, day, endH, endM);
    
    const eventId = Date.now().toString();
    const eventObj = {
      id: eventId,
      title: newEventTitle,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      category: newEventCategory,
      priority: newEventPriority,
      recurring: newEventRecurring
    };

    if (user) {
      setDoc(doc(db, 'users', user.uid, 'events', eventId), eventObj);
    } else {
      setCustomEvents(prev => [...prev, {
        id: eventId,
        title: newEventTitle,
        start: startDate,
        end: endDate,
        category: newEventCategory,
        priority: newEventPriority,
        recurring: newEventRecurring
      }]);
    }
    
    if (googleAccessToken) {
      try {
        fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: newEventTitle,
            start: {
              dateTime: startDate.toISOString(),
            },
            end: {
              dateTime: endDate.toISOString(),
            }
          })
        }).then(res => {
          if (!res.ok) console.error("Failed to add to Google Calendar");
        });
      } catch (e) {
        console.error('Failed to add to Google Calendar', e);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(startDate);
    eventDay.setHours(0, 0, 0, 0);
    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    let timeText = 'Today';
    if (diffDays === 1) timeText = '1 day left';
    else if (diffDays > 1) timeText = `${diffDays} days left`;
    else if (diffDays < 0) timeText = `${Math.abs(diffDays)} days ago`;
    
    setNudges(prev => [{
      id: eventId,
      title: `Upcoming: ${newEventTitle}`,
      time: timeText,
      type: diffDays <= 1 && diffDays >= 0 ? 'urgent' : 'suggestion',
      actionLabel: 'View Schedule',
      status: 'idle',
      timerSeconds: 0
    }, ...prev]);
    
    setNewEventTitle('');
    setNewEventStart('10:00');
    setNewEventEnd('11:00');
    setNewEventDate(formatDate(new Date()));
    setNewEventCategory('Logistics');
    setNewEventPriority('Medium');
    setNewEventRecurring('none');
    setIsAddEventModalOpen(false);
  };

  const toggleScheduleItemSelection = (id: string, source: string) => {
    setSelectedScheduleItems(prev => {
      const isSelected = prev.some(item => item.id === id && item.source === source);
      if (isSelected) {
        return prev.filter(item => !(item.id === id && item.source === source));
      } else {
        return [...prev, { id, source }];
      }
    });
  };

  const handleSelectAllScheduleItems = () => {
    if (selectedScheduleItems.length === generatedSchedule.length) {
      setSelectedScheduleItems([]);
    } else {
      setSelectedScheduleItems(generatedSchedule.map(item => ({ id: item.id, source: item.source })));
    }
  };

  const handleBulkDeleteScheduleItems = async () => {
    const eventIdsToDelete = selectedScheduleItems.filter(item => item.source === 'event').map(item => item.id);
    const taskIdsToDelete = selectedScheduleItems.filter(item => item.source === 'task').map(item => item.id);

    if (eventIdsToDelete.length > 0) {
      setCustomEvents(prev => prev.filter(ev => !eventIdsToDelete.includes(ev.id)));
    }
    if (taskIdsToDelete.length > 0 && user) {
      const batch = writeBatch(db);
      taskIdsToDelete.forEach(id => {
        batch.delete(doc(db, 'users', user.uid, 'tasks', id));
      });
      await batch.commit();
    }
    
    setSelectedScheduleItems([]);
    showToast(`${selectedScheduleItems.length} items deleted`);
  };

  const handleBulkCompleteScheduleItems = async () => {
    const taskIdsToComplete = selectedScheduleItems.filter(item => item.source === 'task').map(item => item.id);

    if (taskIdsToComplete.length > 0 && user) {
      const batch = writeBatch(db);
      taskIdsToComplete.forEach(id => {
        batch.update(doc(db, 'users', user.uid, 'tasks', id), { 
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }
    
    // For custom events we don't have a status, maybe just remove them or ignore. Let's just remove them if marked complete.
    const eventIdsToComplete = selectedScheduleItems.filter(item => item.source === 'event').map(item => item.id);
    if (eventIdsToComplete.length > 0) {
      if (user) {
        const batch = writeBatch(db);
        eventIdsToComplete.forEach(id => {
          batch.delete(doc(db, 'users', user.uid, 'events', id));
        });
        await batch.commit();
      } else {
        setCustomEvents(prev => prev.filter(ev => !eventIdsToComplete.includes(ev.id)));
      }
    }

    setSelectedScheduleItems([]);
    showToast(`${selectedScheduleItems.length} items marked completed`);
  };

  const handleGanttPointerDown = (e: React.PointerEvent, slot: any, action: 'move' | 'resize-start' | 'resize-end') => {
    e.stopPropagation();
    e.preventDefault();
    const container = document.getElementById('gantt-container');
    if (!container) return;
    const width = container.clientWidth;
    const { duration, minTime } = ganttContextRef.current;
    
    if (duration <= 0 || width <= 0) return;

    const initialX = e.clientX;
    const initialStart = slot.timestamp;
    const initialEnd = slot.endTime;
    
    const handlePointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - initialX;
      const deltaTime = (deltaX / width) * duration;
      // snap to 5 mins = 300000 ms
      const snapDelta = Math.round(deltaTime / 300000) * 300000;
      
      let newStart = initialStart;
      let newEnd = initialEnd;
      
      if (action === 'move') {
        newStart += snapDelta;
        newEnd += snapDelta;
      } else if (action === 'resize-end') {
        newEnd += snapDelta;
        if (newEnd <= newStart + 300000) newEnd = newStart + 300000;
      } else if (action === 'resize-start') {
        newStart += snapDelta;
        if (newStart >= newEnd - 300000) newStart = newEnd - 300000;
      }
      
      setTempGanttState({ id: slot.id, source: slot.source, newStart, newEnd });
    };
    
    const handlePointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      
      setTempGanttState(prev => {
        if (prev) {
          if (slot.source === 'event') {
             setCustomEvents(evts => evts.map(evt => evt.id === slot.id ? { ...evt, start: new Date(prev.newStart), end: new Date(prev.newEnd) } : evt));
          } else if (slot.source === 'task' && user) {
             const newStartIso = new Date(prev.newStart).toISOString();
             const newDuration = Math.round((prev.newEnd - prev.newStart) / 60000);
             updateDoc(doc(db, 'users', user.uid, 'tasks', slot.id), {
                scheduledStart: newStartIso,
                estimatedDuration: newDuration
             });
          }
        }
        return null;
      });
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleGeneratePlan = async () => {
    setIsPlanningModalOpen(true);
    setIsPlanning(true);
    setPlanningResult('');
    try {
      const WORKING_HOURS = { start: '08:00', end: '22:00' };
      const todayStart = new Date(scheduleDate);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(scheduleDate);
      todayEnd.setHours(23, 59, 59, 999);
      const todaysEvents = getEventsForDate(scheduleDate);
      
      const gaps = calculateAvailableGaps(todaysEvents, WORKING_HOURS, scheduleDate);
      const assignedBlocks = assignTasksToSlots(filteredTasks, gaps);
      
      const prompt = generateItineraryPrompt(filteredTasks, assignedBlocks, todaysEvents);

      const response = await fetch('/api/plan-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Failed to generate plan");
      }
      const data = await response.json();
      setPlanningResult(data.itinerary);
    } catch (error: any) {
      console.error(error);
      setPlanningResult(error.message || "Failed to generate plan. Please try again later.");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 p-4 md:p-8 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Header */}
      <header className="flex flex-wrap justify-between items-center mb-10 w-full gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-50 transition-colors lg:hidden"
          >
            <div className="space-y-1.5">
              <span className={`block w-6 h-0.5 bg-current transform transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-6 h-0.5 bg-current transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-6 h-0.5 bg-current transform transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight hidden sm:block text-zinc-100">
              TaskPulse
            </h1>
          </div>
        </div>

        <div className="flex-1 w-full order-3 md:order-none md:max-w-2xl mt-4 md:mt-0 relative">
          <div className="flex border border-zinc-800 rounded-xl bg-zinc-900/50 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
            <button
              onClick={() => {
                setSearchMode(searchMode === 'search' ? 'ai' : 'search');
                setShowAiResults(false);
              }}
              className={`px-3 py-2 text-xs font-mono tracking-wider uppercase border-r border-zinc-800 flex items-center gap-1.5 transition-colors ${searchMode === 'ai' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'}`}
            >
              {searchMode === 'ai' ? <Brain className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
              {searchMode === 'ai' ? 'AI Helper' : 'Search'}
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchMode === 'ai') {
                  handleAiTaskSearch();
                }
              }}
              placeholder={searchMode === 'ai' ? "Ask AI to generate tasks (e.g. 'study timetable')..." : "Search tasks by title, status..."}
              className="w-full bg-transparent py-2 px-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            {searchMode === 'ai' && (
              <button
                onClick={handleAiTaskSearch}
                disabled={isAiSearching || !searchQuery.trim()}
                className="px-4 py-2 bg-emerald-500 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-r-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center justify-center min-w-[80px]"
              >
                {isAiSearching ? <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" /> : 'Generate'}
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          <AnimatePresence>
            {((showAiResults && searchMode === 'ai') || (searchQuery.trim().length > 0 && searchMode === 'search')) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 w-full mt-2 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-4 shadow-2xl z-[60] max-h-[60vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
                  <h3 className={`text-xs font-mono uppercase tracking-widest flex items-center gap-2 ${searchMode === 'ai' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {searchMode === 'ai' ? <><Brain className="w-4 h-4" /> AI Suggested Tasks</> : <><Search className="w-4 h-4" /> Search Results</>}
                  </h3>
                  <button onClick={() => { setShowAiResults(false); if (searchMode === 'search') setSearchQuery(''); }} className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {searchMode === 'ai' ? (
                  isAiSearching ? (
                    <div className="py-8 text-center text-zinc-500 text-sm font-mono flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                      Generating tasks...
                    </div>
                  ) : aiSearchResults.length > 0 ? (
                    <div className="space-y-3">
                      {aiSearchResults.map((task) => (
                        <div key={task.id} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4 group/ai-task hover:border-zinc-700 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                                task.priority.toUpperCase() === 'HIGH' || task.priority.toUpperCase() === 'CRITICAL' ? 'text-red-400 border-red-400/20 bg-red-400/10' : 
                                task.priority.toUpperCase() === 'MEDIUM' || task.priority.toUpperCase() === 'MODERATE' ? 'text-orange-400 border-orange-400/20 bg-orange-400/10' : 
                                'text-blue-400 border-blue-400/20 bg-blue-400/10'
                              }`}>
                                {task.priority}
                              </span>
                              {task.estimatedDuration && (
                                <span className="text-zinc-500 text-[10px] font-mono flex items-center gap-1 border border-zinc-800 px-1.5 py-0.5 rounded-md bg-zinc-900/40 backdrop-blur-md">
                                  <Clock className="w-3 h-3" />
                                  {task.estimatedDuration}m
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-medium text-zinc-200">{task.title}</h4>
                            {task.subTasks && task.subTasks.length > 0 && (
                              <div className="mt-2 text-xs text-zinc-500 space-y-1">
                                {task.subTasks.slice(0, 2).map((st, i) => (
                                  <div key={i} className="flex items-start gap-1">
                                    <div className="w-1 h-1 rounded-full bg-zinc-700 mt-1.5 shrink-0" />
                                    <span className="truncate">{st}</span>
                                  </div>
                                ))}
                                {task.subTasks.length > 2 && <div className="pl-2 text-[10px]">+{task.subTasks.length - 2} more steps</div>}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => {
                              addAiGeneratedTask(task);
                              setAiSearchResults(prev => prev.filter(t => t.id !== task.id));
                            }}
                            className="shrink-0 p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-zinc-950 transition-colors"
                            title="Add to Quick Add / Tasks"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-zinc-500 text-sm font-mono border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                      No tasks generated. Try a different prompt.
                    </div>
                  )
                ) : (
                  tasks.filter(task => {
                    const query = searchQuery.toLowerCase();
                    return task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
                  }).length > 0 ? (
                    <div className="space-y-3">
                      {tasks.filter(task => {
                        const query = searchQuery.toLowerCase();
                        return task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
                      }).slice(0, 5).map((task) => (
                        <div key={task.id} className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4 group/search-task hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => { setCurrentView('tasks'); setSearchQuery(task.title); }}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                                task.status === 'completed' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' :
                                task.priority?.toUpperCase() === 'HIGH' || task.priority?.toUpperCase() === 'CRITICAL' ? 'text-red-400 border-red-400/20 bg-red-400/10' : 
                                task.priority?.toUpperCase() === 'MEDIUM' || task.priority?.toUpperCase() === 'MODERATE' ? 'text-orange-400 border-orange-400/20 bg-orange-400/10' : 
                                'text-blue-400 border-blue-400/20 bg-blue-400/10'
                              }`}>
                                {task.status === 'completed' ? 'Completed' : task.priority || 'No Priority'}
                              </span>
                            </div>
                            <h4 className={`text-sm font-medium ${task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{task.title}</h4>
                            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{task.description}</p>
                          </div>
                          <button 
                            className="shrink-0 p-2 rounded-lg bg-zinc-800/50 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200 transition-colors group-hover/search-task:bg-zinc-700"
                            title="View Task"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-zinc-500 text-sm font-mono border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                      No tasks found matching "{searchQuery}"
                    </div>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono text-white/50">
          <Clock className="w-4 h-4 hidden sm:block" />
          <span className="hidden sm:inline mr-2">{new Date().toLocaleTimeString()}</span>
          <UserProfileDropdown user={user} tasks={tasks} globalStreak={globalStreak} notificationsCount={notifications.length} onOpenSettings={() => setIsSettingsModalOpen(true)} onOpenNotifications={() => setIsNotificationsModalOpen(true)} onLogout={handleLogout} googleAccessToken={googleAccessToken} onConnectCalendar={async () => { try { await signInWithGoogle(true); showToast('Google Calendar connected'); } catch(e: any) { if (e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-blocked') { console.error(e); showToast('Failed to connect Calendar'); } else if (e.code === 'auth/popup-blocked') { showToast('Popup blocked by browser. Please allow popups.'); } } }} />
        </div>
      </header>

      {/* Navigation Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            className="fixed inset-y-0 left-0 w-72 bg-black/60 backdrop-blur-3xl border-r border-white/10 z-50 pt-28 px-6 pb-6 shadow-2xl flex flex-col"
          >
            <nav className="space-y-2 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as any);
                    setIsMenuOpen(false);
                  }}
                  title={item.tooltip}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                    currentView === item.id 
                      ? 'bg-gradient-to-r from-[#4fb7b3]/20 to-transparent border border-[#4fb7b3]/50 text-[#a8fbd3]' 
                      : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </nav>
            <UserProfileCard user={user} tasks={tasks} globalStreak={globalStreak} notificationsCount={notifications.length} onOpenSettings={() => setIsSettingsModalOpen(true)} onOpenNotifications={() => setIsNotificationsModalOpen(true)} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <main className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative z-30">
        
        {/* Left Nav Menu on Large Screens */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
           <div className="sticky top-8 flex flex-col gap-6">
             
             {/* Profile Section */}
             <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                   <User className="w-5 h-5 text-emerald-400" />
                 </div>
                 <div className="flex-1 overflow-hidden">
                   <div className="text-sm font-semibold text-zinc-100 truncate">{user?.displayName || 'User'}</div>
                   <div className="text-[10px] font-mono text-zinc-500 truncate">{user?.email || 'user@taskpulse.com'}</div>
                 </div>
                 <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-all" title="Settings">
                   <Target className="w-4 h-4" />
                 </button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Streak</span>
                    <span className="text-xs font-semibold text-zinc-200">{globalStreak} Days</span>
                 </div>
                 <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Completed</span>
                    <span className="text-xs font-semibold text-zinc-200">{tasks.filter(t => t.status === 'completed').length}</span>
                 </div>
               </div>
             </div>

             {/* Navigation */}
             <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id as any)}
                      title={item.tooltip}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive 
                          ? 'bg-zinc-800 text-zinc-50' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'group-hover:text-zinc-300'}`} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
             </nav>

             <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Log out securely">
               <LogOut className="w-4 h-4" />
               Log Out
             </button>
           </div>
        </div>

        {/* Dynamic Content Area based on currentView */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          
          {/* OVERVIEW */}
          {currentView === 'overview' && (
            <div className="col-span-1 md:col-span-2 space-y-6 md:space-y-8 animate-in fade-in duration-500 order-1">
              {/* Header */}
              <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 md:p-8 rounded-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div className="relative z-10">
                   <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                     Welcome back.
                   </h2>
                   <p className="text-sm text-zinc-400">
                     You have <span className="text-emerald-400 font-semibold">{tasks.filter(t => t.status === 'pending').length}</span> tasks pending and <span className="text-blue-400 font-semibold">{tasks.filter(t => t.status === 'completed').length}</span> completed.
                   </p>
                 </div>
                 <button 
                   onClick={() => setCurrentView('schedule')} 
                   className="relative z-10 shrink-0 bg-emerald-500 text-zinc-950 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition-colors"
                 >
                   View Schedule
                 </button>
              </section>

              {/* Top Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-2xl border border-zinc-800 transition-colors">
                  <div className="text-4xl font-bold text-emerald-500 mb-1">{productivityStats.avgCompletion}%</div>
                  <div className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Avg Completion</div>
                </div>
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-2xl border border-zinc-800 transition-colors">
                  <div className="text-4xl font-bold text-blue-500 mb-1">{productivityStats.totalFocusHours}h</div>
                  <div className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-500" /> Total Focus Time</div>
                </div>
                <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-2xl border border-zinc-800 transition-colors">
                  <div className="text-4xl font-bold text-indigo-400 mb-1">{productivityStats.avgHabitConsistency}%</div>
                  <div className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2"><Target className="w-3.5 h-3.5 text-indigo-400" /> Habit Consistency</div>
                </div>
              </div>

              {/* Productivity Trends */}
              <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden">
                <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Productivity Trends
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={productivityData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completionRate" 
                        name="Completion Rate (%)"
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#09090b', stroke: '#10b981', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#10b981', stroke: '#09090b' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="habitConsistency" 
                        name="Habit Consistency (%)"
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#09090b', stroke: '#3b82f6', strokeWidth: 2 }}
                        strokeDasharray="4 4"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Asymmetric Bento Grid */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={bentoOrder} strategy={rectSortingStrategy}>
                  <div className="flex flex-wrap gap-6 md:gap-8 items-stretch">
                    {bentoOrder.map((sectionId, index) => {
                      if (sectionId === 'quickAdd') return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(40%-1rem)] flex-grow flex flex-col justify-center bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <Plus className="w-4 h-4 text-emerald-500" /> Quick Add
                            </h2>
                            <div className="px-2 py-1 bg-zinc-800 rounded-md border border-zinc-700 flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                              <Sparkles className="w-3 h-3 text-emerald-500" /> Auto-Magic
                            </div>
                          </div>

                          <form onSubmit={handleIngestTask} className="relative group/form flex flex-col z-10">
                            <div className="relative rounded-2xl bg-zinc-950/40 backdrop-blur-md border border-zinc-800 flex flex-col overflow-hidden focus-within:border-emerald-500/50 transition-colors">
                              <textarea
                                ref={textareaRef}
                                value={inputTask}
                                onChange={handleTextareaChange}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (inputTask.trim()) handleIngestTask();
                                  }
                                }}
                                placeholder={placeholderText || "Type a task, e.g. 'Review quarterly report by Friday 3pm'"}
                                rows={2}
                                className="w-full bg-transparent p-5 text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none text-base md:text-lg leading-relaxed"
                                style={{ minHeight: '80px' }}
                              />
                              <div className="flex flex-wrap items-center justify-between p-3 border-t border-zinc-800 bg-zinc-900/40 backdrop-blur-md gap-3">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                                  <div className="flex items-center gap-2">
                                    {['HIGH', 'MODERATE', 'LOW'].map(p => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={() => setQuickAddPriority(quickAddPriority === p ? null : p as any)}
                                        className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all ${
                                          quickAddPriority === p 
                                            ? (p === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/30' : p === 'MODERATE' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-blue-400/10 text-blue-400 border-blue-400/30')
                                            : 'bg-zinc-900/40 backdrop-blur-md text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                                        }`}
                                      >
                                        {p}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="w-px h-6 bg-zinc-800 mx-2 hidden sm:block" />
                                  <div className="flex items-center gap-2">
                                    {['daily', 'weekly'].map(r => (
                                      <button
                                        key={r}
                                        type="button"
                                        onClick={() => setQuickAddRecurring(quickAddRecurring === r ? 'none' : r as any)}
                                        className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all flex items-center gap-1 ${
                                          quickAddRecurring === r
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                            : 'bg-zinc-900/40 backdrop-blur-md text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                                        }`}
                                      >
                                        {r}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="w-px h-6 bg-zinc-800 mx-2 hidden sm:block" />
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="date"
                                      value={quickAddDate}
                                      onChange={(e) => setQuickAddDate(e.target.value)}
                                      className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all bg-zinc-900/40 backdrop-blur-md text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                                      title="Schedule Date"
                                    />
                                    <input 
                                      type="time"
                                      value={quickAddTime}
                                      onChange={(e) => setQuickAddTime(e.target.value)}
                                      className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all bg-zinc-900/40 backdrop-blur-md text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                                      title="Schedule Time"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <button
                                    type="button"
                                    onClick={toggleRecording}
                                    className={`p-2 rounded-xl border transition-all ${isRecording ? 'bg-red-500/20 text-red-500 border-red-500/30 animate-pulse' : 'bg-zinc-900/40 backdrop-blur-md text-zinc-500 border-zinc-800 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'}`}
                                    title="Voice input"
                                  >
                                    <Mic className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isProcessing || !inputTask.trim()}
                                    className="bg-emerald-500 text-zinc-950 px-4 py-2 flex items-center gap-2 rounded-xl font-bold text-sm hover:bg-emerald-400 transition-colors disabled:opacity-50"
                                    title="Add task (Enter)"
                                  >
                                    {isProcessing ? (
                                      <>
                                        <div className="w-3.5 h-3.5 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                                        <span className="hidden sm:inline">Adding...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>Add</span>
                                        <div className="bg-zinc-900/20 rounded px-1 py-0.5 text-[9px] font-mono opacity-60 hidden sm:block">↵</div>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            <AnimatePresence>
                              {showSuccessSparkle && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.5, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: -20 }}
                                  exit={{ opacity: 0, scale: 1.5, y: -30 }}
                                  className="absolute top-0 right-10 pointer-events-none"
                                >
                                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/30 backdrop-blur-md">
                                    <Zap className="w-3 h-3" /> Added!
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </form>
                          <div className="mt-4 flex flex-wrap justify-between items-center text-xs font-mono text-white/30 px-2">
                            <div className="flex gap-2">
                              <span>#work</span>
                              <span>#personal</span>
                              <span>#urgent</span>
                            </div>
                            <span className="italic text-white/20">AI Auto-tagging Active</span>
                          </div>
                        </SortableGridItem>
                      );

                      if (sectionId === 'upNext') {
                        const upNextTasks = tasks
                          .filter(t => t.status === 'pending')
                          .filter(t => {
                            if (upNextFilter === 'ALL') return true;
                            const p = t.priority?.toUpperCase() || '';
                            if (upNextFilter === 'HIGH') return p === 'CRITICAL' || p === 'HIGH';
                            if (upNextFilter === 'MEDIUM') return p === 'MODERATE' || p === 'MEDIUM';
                            if (upNextFilter === 'LOW') return p === 'LOW';
                            return true;
                          })
                          .sort((a, b) => {
                            if (upNextSort === 'default') return 0;
                            const getWeight = (p: string) => {
                              const up = p?.toUpperCase() || '';
                              if (up === 'CRITICAL' || up === 'HIGH') return 3;
                              if (up === 'MODERATE' || up === 'MEDIUM') return 2;
                              if (up === 'LOW') return 1;
                              return 0;
                            };
                            const weightA = getWeight(a.priority);
                            const weightB = getWeight(b.priority);
                            return upNextSort === 'priority-desc' ? weightB - weightA : weightA - weightB;
                          });

                        return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(60%-1rem)] flex-grow bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-emerald-500" /> Up Next
                            </h2>
                            <div className="flex items-center gap-2 z-20">
                              <div className="flex bg-zinc-950/40 backdrop-blur-md rounded-lg p-1 border border-zinc-800">
                                {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(filter => (
                                  <button
                                    key={filter}
                                    onClick={() => setUpNextFilter(filter as any)}
                                    className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${upNextFilter === filter ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                                  >
                                    {filter}
                                  </button>
                                ))}
                              </div>
                              <button 
                                onClick={() => setUpNextSort(prev => prev === 'default' ? 'priority-desc' : prev === 'priority-desc' ? 'priority-asc' : 'default')}
                                className={`p-1.5 rounded-lg border transition-colors ${upNextSort !== 'default' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-950/40 backdrop-blur-md border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                                title="Sort Priority"
                              >
                                <Target className={`w-3.5 h-3.5 transition-transform ${upNextSort === 'priority-asc' ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col relative pb-4 z-10 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence>
                              {upNextTasks.map((task, idx) => (
                                <motion.div 
                                  layout
                                  key={task.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ delay: idx * 0.1, layout: { type: "spring", bounce: 0.2, duration: 0.6 } }}
                                  style={{ zIndex: 30 - idx }}
                                  className={`relative flex items-start justify-between p-5 md:p-6 border rounded-2xl transition-all duration-300 group/item ${
                                    idx === 0 
                                      ? 'bg-zinc-900/40 backdrop-blur-md border-emerald-500/30 shadow-lg hover:-translate-y-1' 
                                      : 'bg-zinc-950/40 backdrop-blur-md border-zinc-800 hover:border-zinc-700 hover:-translate-y-1 opacity-90 hover:opacity-100'
                                  } ${idx > 0 ? '-mt-3 scale-[0.98]' : ''}`}
                                >
                                   <div className="flex flex-col w-full max-w-[calc(100%-130px)]">
                                      <h4 className={`font-semibold text-base md:text-lg mb-3 ${idx === 0 ? 'text-zinc-100' : 'text-zinc-300'} group-hover/item:text-zinc-50 transition-colors`}>{task.title}</h4>
                                      
                                      <div className="flex flex-wrap items-center gap-2 mb-3">
                                        {task.estimatedDuration && (
                                          <span className="text-zinc-400 text-[10px] font-mono flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-md">
                                            <Clock className="w-3 h-3" />
                                            {task.estimatedDuration}m
                                          </span>
                                        )}
                                        {task.score !== undefined && (
                                          <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                                            <Brain className="w-3 h-3" />
                                            Score: {Math.round(task.score)}
                                          </span>
                                        )}
                                        {task.priority && (
                                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md border ${
                                            task.priority.toUpperCase() === 'HIGH' || task.priority.toUpperCase() === 'CRITICAL' ? 'text-red-400 border-red-500/20 bg-red-500/10' : 
                                            task.priority.toUpperCase() === 'MEDIUM' || task.priority.toUpperCase() === 'MODERATE' ? 'text-orange-400 border-orange-500/20 bg-orange-500/10' : 
                                            'text-blue-400 border-blue-500/20 bg-blue-500/10'
                                          }`}>
                                            {task.priority}
                                          </span>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleTaskSteps(task); }}
                                          disabled={generatingStepsFor === task.id}
                                          className="flex items-center gap-1.5 px-2 py-1 bg-transparent border border-zinc-700 rounded-md text-[10px] uppercase font-bold text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
                                        >
                                          {generatingStepsFor === task.id ? (
                                            <><RefreshCw className="w-3 h-3 animate-spin" /> Generating...</>
                                          ) : (
                                            <><Brain className="w-3 h-3" /> {expandedStepsFor === task.id ? 'Hide plan' : 'How to complete'}</>
                                          )}
                                        </button>
                                      </div>

                                      {task.aiExplanation && (
                                        <div className="flex items-start gap-2 mt-1 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl backdrop-blur-sm">
                                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                          <p className="text-[11px] md:text-xs text-emerald-400/90 leading-relaxed font-medium">
                                            {task.aiExplanation}
                                          </p>
                                        </div>
                                      )}

                                      {task.locationQuery && (
                                        <div className="mt-3">
                                          <TaskMapContext query={task.locationQuery} />
                                        </div>
                                      )}

                                      {expandedStepsFor === task.id && task.subTasks && task.subTasks.length > 0 && (
                                        <div className="mt-3 space-y-2 bg-zinc-950/40 backdrop-blur-md border border-zinc-800 p-4 rounded-xl">
                                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">AI Suggested Plan</p>
                                          {task.subTasks.map((step, i) => (
                                            <div key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                              <span className="text-emerald-400 font-bold shrink-0 mt-0.5">{i+1}.</span> 
                                              <span className="leading-relaxed">{step}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                   </div>
                                   
                                   <div className="flex flex-col sm:flex-row items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity absolute right-4 md:right-6 top-5">
                                      <button 
                                        onClick={() => handleStartFocus(task.id)}
                                        className="flex items-center gap-1 text-[10px] md:text-xs font-bold uppercase tracking-wider bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg hover:bg-emerald-400 transition-colors"
                                      >
                                        <Maximize2 className="w-3 h-3" /> Focus
                                      </button>
                                      <button 
                                        onClick={() => completeTask(task.id)} 
                                        className="text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all p-2 rounded-full shrink-0"
                                      >
                                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                                      </button>
                                   </div>
                                   
                                   {/* Placeholder dot to maintain layout if needed */}
                                   <div className="w-6 md:w-8 shrink-0 group-hover/item:opacity-0 transition-opacity flex justify-end absolute right-5 top-7">
                                      <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-emerald-500 shadow-sm' : 'bg-zinc-700'}`} />
                                   </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            {upNextTasks.length === 0 && (
                              <div className="text-center py-8 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                                No pending tasks.
                              </div>
                            )}
                          </div>
                        </SortableGridItem>
                      );}

                      if (sectionId === 'nudges') return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(35%-1rem)] flex-grow flex flex-col justify-between bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <BellRing className="w-4 h-4 text-indigo-400" /> AI Nudges
                            </h2>
                          </div>
                          <div className="space-y-3 z-10 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence>
                              {nudges.map((nudge, idx) => (
                                <motion.div 
                                  layout
                                  key={nudge.id}
                                  initial={{ opacity: 0, x: -10, scale: 0.95 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: 20, scale: 0.9 }}
                                  transition={{ delay: idx * 0.1, duration: 0.3, layout: { type: "spring", bounce: 0.2, duration: 0.6 } }}
                                  className={`group/nudge relative p-4 rounded-xl border flex flex-col gap-3 transition-all duration-300 ${
                                    nudge.type === 'urgent' 
                                      ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10' 
                                      : 'bg-indigo-500/5 border-indigo-500/30 hover:border-indigo-500/50 hover:bg-indigo-500/10'
                                  }`}
                                >
                                  {nudge.type === 'urgent' && (
                                    <div className="absolute inset-0 rounded-xl border border-red-500/50 animate-pulse pointer-events-none" />
                                  )}
                                  
                                  <div className="flex items-start gap-4">
                                    <div className={`mt-0.5 p-2 rounded-full shrink-0 ${nudge.type === 'urgent' ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
                                      <BellRing className={`w-4 h-4 ${nudge.type === 'urgent' ? 'text-red-400' : 'text-indigo-400'}`} />
                                    </div>
                                    <div className="pr-6">
                                      <div className="text-sm font-medium text-zinc-200 group-hover/nudge:text-zinc-50 transition-colors">{nudge.title}</div>
                                      <div className="text-xs font-mono text-zinc-500 mt-1.5 flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${nudge.type === 'urgent' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                                        {nudge.time}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {nudge.actionLabel && nudge.status === 'idle' && (
                                    <div className="pl-12 flex gap-2">
                                      <button 
                                        onClick={() => toggleNudgeTimer(nudge.id)}
                                        className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all ${
                                          nudge.type === 'urgent'
                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-zinc-950 border border-red-500/20'
                                            : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-zinc-950 border border-indigo-500/20'
                                        }`}
                                      >
                                        Start
                                      </button>
                                      {nudge.actionLabel !== 'Start' && (
                                        <button 
                                          onClick={() => dismissNudge(nudge.id)}
                                          className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200`}
                                        >
                                          {nudge.actionLabel}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {nudge.status === 'running' && (
                                    <div className="pl-12 flex items-center gap-3">
                                      <div className="font-mono text-indigo-400 text-sm font-bold flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                        {formatTimer(nudge.timerSeconds)}
                                      </div>
                                      <button 
                                        onClick={() => toggleNudgeTimer(nudge.id)}
                                        className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#4fb7b3]/20 text-[#a8fbd3] hover:bg-[#4fb7b3]/30 transition-all border border-[#4fb7b3]/20 hover:shadow-[0_0_10px_rgba(79,183,179,0.3)]"
                                      >
                                        Finish
                                      </button>
                                    </div>
                                  )}

                                  {nudge.status === 'finished' && (
                                    <div className="pl-12">
                                      <span className="text-xs font-bold text-green-400 flex items-center gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 w-fit">
                                        <CheckCircle2 className="w-4 h-4" /> Completed ({formatTimer(nudge.timerSeconds)})
                                      </span>
                                    </div>
                                  )}
                                  
                                  <button 
                                    onClick={() => dismissNudge(nudge.id)}
                                    className="absolute top-3 right-3 p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover/nudge:opacity-100 transition-all focus:opacity-100"
                                    title="Dismiss"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            <AnimatePresence>
                              {nudges.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                  <div className="relative mb-6">
                                    <div className="relative w-16 h-16 rounded-full bg-zinc-950/40 backdrop-blur-md border border-zinc-800 flex items-center justify-center overflow-hidden shadow-inner">
                                      <BellRing className="w-6 h-6 text-zinc-700" />
                                    </div>
                                  </div>
                                  <div className="text-zinc-500 text-sm font-medium mb-1">AI Systems Quiet</div>
                                  <div className="text-zinc-600 text-xs font-mono">You're completely caught up.</div>
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        </SortableGridItem>
                      );

                      if (sectionId === 'recentActivity') return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(65%-1rem)] flex-grow bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-500" /> Recent Activity
                            </h2>
                          </div>
                          <div className="relative ml-2 space-y-0 z-10 max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                            <AnimatePresence>
                              {[...tasks].filter(t => t.status === 'completed').sort((a, b) => new Date(b.completedAt || b.deadline).getTime() - new Date(a.completedAt || a.deadline).getTime()).map((task, idx, arr) => (
                                <motion.div 
                                  layout
                                  key={task.id} 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ delay: idx * 0.1, layout: { type: "spring", bounce: 0.2, duration: 0.6 } }}
                                  className="relative group/activity pl-8 pb-6 last:pb-0"
                                >
                                  {/* Vertical Timeline Connector */}
                                  {idx !== arr.length - 1 && (
                                    <div className="absolute left-[3px] top-3 bottom-0 w-px bg-zinc-800 group-hover/activity:bg-zinc-700 transition-colors duration-500" />
                                  )}
                                  {/* Timeline Node */}
                                  <div className="absolute left-0 top-3 w-2 h-2 rounded-full bg-amber-500 ring-4 ring-zinc-900 group-hover/activity:scale-150 transition-transform duration-300" />
                                  
                                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950/40 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 transition-all duration-300">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-zinc-500 line-through decoration-zinc-700 group-hover/activity:text-zinc-400 group-hover/activity:decoration-zinc-600 transition-colors">{task.title}</h4>
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-[10px] font-mono text-zinc-600 uppercase flex items-center gap-1 group-hover/activity:text-zinc-500 transition-colors">
                                          <Clock className="w-3 h-3" /> {task.completedAt ? (
                                            (() => {
                                              const diff = Math.max(0, Date.now() - new Date(task.completedAt).getTime());
                                              const m = Math.floor(diff / 60000);
                                              const h = Math.floor(m / 60);
                                              const d = Math.floor(h / 24);
                                              if (d > 0) return `${d}d ago`;
                                              if (h > 0) return `${h}h ago`;
                                              if (m > 0) return `${m}m ago`;
                                              return 'Just now';
                                            })()
                                          ) : 'Just now'}
                                        </span>
                                        {task.score !== undefined && (
                                          <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                            <Brain className="w-3 h-3" />
                                            +{Math.round(task.score)} XP
                                          </span>
                                        )}
                                        {task.estimatedDuration && (
                                          <span className="text-amber-500 text-[10px] font-mono flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                            <Target className="w-3 h-3" />
                                            {task.estimatedDuration}m logged
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => undoTask(task.id)}
                                      className="opacity-0 group-hover/activity:opacity-100 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-zinc-950 px-3 py-2 rounded-lg transition-all focus:opacity-100 shrink-0"
                                      title="Undo completion"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" /> Undo
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                            {tasks.filter(t => t.status === 'completed').length === 0 && (
                              <div className="flex flex-col items-center justify-center py-10 px-4 text-center -ml-2">
                                <div className="relative mb-6 w-32 h-24 flex items-center justify-center">
                                  <div className="absolute inset-0 bg-amber-500/5 blur-xl rounded-full pointer-events-none" />
                                  {/* Timeline visual */}
                                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-zinc-800" />
                                  
                                  {/* Floating nodes */}
                                  <motion.div 
                                    animate={{ y: [0, -4, 0] }} 
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-md flex items-center px-2 gap-2 z-10 shadow-sm"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                                    <div className="flex-1 h-1 bg-zinc-800 rounded-full" />
                                  </motion.div>
                                  
                                  <motion.div 
                                    animate={{ y: [0, 4, 0] }} 
                                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-20 h-8 bg-zinc-950/40 backdrop-blur-md border border-amber-500/20 rounded-md flex items-center px-2 gap-2 shadow-sm z-10"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <div className="flex-1 h-1 bg-zinc-800 rounded-full" />
                                  </motion.div>
                                </div>
                                <div className="text-zinc-500 text-sm font-medium mb-1">Awaiting Activity</div>
                                <div className="text-zinc-600 text-xs font-mono">Completed tasks will appear here.</div>
                              </div>
                            )}
                          </div>
                        </SortableGridItem>
                      );
                      
                      if (sectionId === 'calendar') return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(50%-1rem)] flex-grow bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#a8fbd3]" /> Upcoming Events
                            </h2>
                            {!googleAccessToken ? (
                              <button onClick={async () => { try { await signInWithGoogle(true); showToast('Calendar connected'); } catch(e: any) { if (e.code !== 'auth/cancelled-popup-request' && e.code !== 'auth/popup-blocked') { console.error(e); } else if (e.code === 'auth/popup-blocked') { showToast('Popup blocked by browser. Please allow popups.'); } } }} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-bold uppercase text-white/60 hover:text-white transition-colors flex items-center gap-2">
                                Connect Calendar
                              </button>
                            ) : (
                              <div className="px-2 py-1 bg-white/5 rounded-md border border-white/10 flex items-center gap-1.5 text-[10px] font-mono text-[#a8fbd3]">
                                Synced
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-3 min-h-[120px] z-10 relative">
                            {isLoadingCalendar ? (
                              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs font-mono flex-col gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" /> Syncing...
                              </div>
                            ) : !googleAccessToken ? (
                              <div className="flex-1 flex flex-col items-center justify-center opacity-80">
                                <Calendar className="w-8 h-8 mb-3 text-zinc-700" />
                                <div className="text-sm font-medium text-zinc-500">Not Connected</div>
                                <div className="text-[10px] font-mono text-zinc-600 mt-1">Connect your Google Calendar to see events</div>
                              </div>
                            ) : calendarEvents.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-mono">
                                No upcoming events
                              </div>
                            ) : (
                              calendarEvents.slice(0, 5).map(event => {
                                const start = new Date(event.start.dateTime || event.start.date);
                                const isToday = start.toDateString() === new Date().toDateString();
                                return (
                                  <div key={event.id} className="flex flex-col gap-1 p-3 bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-sm text-zinc-200 truncate">{event.summary || 'Busy'}</h4>
                                      <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap ml-2 bg-zinc-900/40 backdrop-blur-md px-2 py-0.5 rounded border border-zinc-800">
                                        {isToday ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    {event.description && (
                                      <p className="text-[10px] text-zinc-500 line-clamp-1">{event.description}</p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </SortableGridItem>
                      );
                      
                      if (sectionId === 'taskProgress') return (
                        <SortableGridItem key={sectionId} id={sectionId} index={index} className="w-full lg:w-[calc(50%-1rem)] xl:w-[calc(50%-1rem)] flex-grow bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group">
                          <div className="flex items-center justify-between mb-6 relative z-10">
                            <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                              <Target className="w-4 h-4 text-emerald-500" /> Daily Goals Progress
                            </h2>
                          </div>
                          <div className="space-y-5 z-10 relative">
                            {['CRITICAL', 'HIGH', 'MODERATE', 'LOW'].map(category => {
                              const catTasks = tasks.filter(t => t.priority === category);
                              if (catTasks.length === 0) return null;
                              const completed = catTasks.filter(t => t.status === 'completed').length;
                              const percentage = Math.round((completed / catTasks.length) * 100);
                              
                              let color = '#3b82f6'; // blue-500 for moderate
                              if (category === 'CRITICAL') color = '#ef4444'; // red-500
                              else if (category === 'HIGH') color = '#f97316'; // orange-500
                              else if (category === 'LOW') color = '#9ca3af'; // gray-400
                              
                              return (
                                <div key={category} className="space-y-2">
                                  <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                                    <span className="text-zinc-400 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                      {category}
                                    </span>
                                    <span className="text-zinc-500 font-bold" style={{ color: percentage === 100 ? '#10b981' : 'inherit' }}>
                                      {completed} / {catTasks.length} ({percentage}%)
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-zinc-950/40 backdrop-blur-md rounded-full overflow-hidden border border-zinc-800">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percentage}%` }}
                                      transition={{ duration: 1, ease: "easeOut" }}
                                      className="h-full rounded-full relative"
                                      style={{ backgroundColor: color }}
                                    >
                                    </motion.div>
                                  </div>
                                </div>
                              );
                            })}
                            {tasks.length === 0 && (
                              <div className="text-center py-4 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                                No tasks available to show progress.
                              </div>
                            )}
                          </div>
                        </SortableGridItem>
                      );
                      
                      return null;
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* HABITS */}
          {(currentView === 'habits') && (
            <div className="col-span-1 md:col-span-2 w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 order-2 md:order-1 min-w-0">
              {/* Left Column: Productivity & Insights */}
              <div className="lg:col-span-2 space-y-6 md:space-y-8 min-w-0">
                <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group flex flex-col min-w-0">
                  <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Weekly Productivity
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-zinc-950/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 hover:border-emerald-500/30 transition-colors flex flex-col justify-center">
                      <div className="text-3xl font-black text-zinc-200"><span className="text-emerald-500">{productivityStats.avgCompletion}</span>%</div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Avg Completion</div>
                    </div>
                    <div className="bg-zinc-950/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 hover:border-indigo-400/30 transition-colors flex flex-col justify-center">
                      <div className="text-3xl font-black text-zinc-200"><span className="text-indigo-400">{productivityStats.totalFocusHours}</span>h</div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Total Focus Time</div>
                    </div>
                    <div className="bg-zinc-950/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors flex flex-col justify-center">
                      <div className="text-3xl font-black text-zinc-200"><span className="text-amber-500">{productivityStats.avgHabitConsistency}</span>%</div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Habit Consistency</div>
                    </div>
                  </div>

                  <div className="h-[250px] w-full mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={productivityData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                          dataKey="day" 
                          stroke="#71717a" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                        />
                        <YAxis 
                          stroke="#71717a" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '12px' }}
                          labelStyle={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="completionRate" 
                          name="Completion Rate (%)"
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#09090b', stroke: '#10b981', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#10b981', stroke: '#09090b' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="habitConsistency" 
                          name="Habit Consistency (%)"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#09090b', stroke: '#f59e0b', strokeWidth: 2 }}
                          strokeDasharray="4 4"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                
                <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-emerald-500" /> AI Insights
                    </h2>
                    <button
                      onClick={generateInsights}
                      disabled={isGeneratingInsights}
                      className="text-[10px] font-mono tracking-widest uppercase bg-emerald-500/10 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 border border-emerald-500/20"
                    >
                      {isGeneratingInsights ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {isGeneratingInsights ? 'Analyzing...' : 'Generate'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                    {insights.map((rec, idx) => (
                      <div key={idx} className="bg-zinc-950/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 flex items-start gap-3 hover:border-zinc-700 transition-colors">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✦</span>
                        <p className="text-sm text-zinc-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Column: Habit Tracker */}
              <div className="lg:col-span-1 space-y-6 md:space-y-8 min-w-0">
                <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-400" /> Habit Tracker
                    </h2>
                  </div>
                  
                  <div className="space-y-4 flex-1 relative z-10">
                    {habits.map((habit) => (
                      <div key={habit.id} className="bg-zinc-950/40 backdrop-blur-md p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Target className="w-4 h-4 text-indigo-400" />
                            <span className="font-semibold text-sm tracking-wide text-zinc-200">{habit.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                            <Zap className="w-3 h-3" /> {calculateStreak(habit.completedDays || [])}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1.5">
                          {last7Days.map((dayObj) => {
                            const isCompleted = habit.completedDays.includes(dayObj.dateStr);
                            return (
                              <div key={dayObj.dateStr} className="flex flex-col items-center gap-1.5">
                                <span className="text-[9px] font-mono text-zinc-500 uppercase">{dayObj.dayName[0]}</span>
                                <button
                                  onClick={() => toggleHabit(habit.id, dayObj.dateStr)}
                                  className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${
                                    isCompleted 
                                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' 
                                      : 'border-zinc-800 text-transparent hover:border-zinc-700 hover:bg-zinc-800'
                                  }`}
                                >
                                  {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddHabit} className="mt-6 relative shrink-0">
                    <input
                      type="text"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                      placeholder="Add a new habit..."
                      className="w-full bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-xl p-3 pr-12 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!newHabitName.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 p-1.5 px-3 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* FOCUS */}
          {(currentView === 'focus') && (
            <div className={`col-span-1 space-y-6 md:space-y-8 order-1 md:order-2 ${currentView === 'focus' ? 'md:col-span-2 max-w-3xl mx-auto w-full' : ''}`}>
              
              <div className="space-y-4">
                <AnimatePresence>
                  {nudges.map((nudge, idx) => (
                    <motion.div 
                      key={nudge.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border flex flex-col gap-3 ${nudge.type === 'urgent' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}
                    >
                      <div className="flex items-start gap-4">
                        <BellRing className={`w-5 h-5 mt-0.5 ${nudge.type === 'urgent' ? 'text-rose-400' : 'text-emerald-500'}`} />
                        <div>
                          <div className="text-sm font-semibold text-zinc-200">{nudge.title}</div>
                          <div className="text-xs font-mono text-zinc-500 mt-1">{nudge.time}</div>
                        </div>
                      </div>

                      {nudge.actionLabel && nudge.status === 'idle' && (
                        <div className="pl-9 flex gap-2">
                          <button 
                            onClick={() => toggleNudgeTimer(nudge.id)}
                            className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all ${
                              nudge.type === 'urgent'
                                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                            }`}
                          >
                            Start
                          </button>
                        </div>
                      )}

                      {nudge.status === 'running' && (
                        <div className="pl-9 flex items-center gap-3">
                          <div className="font-mono text-emerald-400 text-sm font-bold flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            {formatTimer(nudge.timerSeconds)}
                          </div>
                          <button 
                            onClick={() => toggleNudgeTimer(nudge.id)}
                            className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20"
                          >
                            Finish
                          </button>
                        </div>
                      )}

                      {nudge.status === 'finished' && (
                        <div className="pl-9">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit">
                            <CheckCircle2 className="w-4 h-4" /> Completed ({formatTimer(nudge.timerSeconds)})
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              
              <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-500" /> Add Task
                </h2>
                <form onSubmit={handleIngestTask} className="relative">
                  <textarea
                    value={inputTask}
                    onChange={(e) => setInputTask(e.target.value)}
                    placeholder="What's on your mind? (e.g. Prep for meeting tomorrow...)"
                    className="w-full bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-xl p-4 pr-12 pb-12 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none h-32"
                  />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <input 
                      type="date"
                      value={quickAddDate}
                      onChange={(e) => setQuickAddDate(e.target.value)}
                      className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all bg-zinc-900/40 backdrop-blur-md text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                      title="Schedule Date"
                    />
                    <input 
                      type="time"
                      value={quickAddTime}
                      onChange={(e) => setQuickAddTime(e.target.value)}
                      className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-lg border transition-all bg-zinc-900/40 backdrop-blur-md text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                      title="Schedule Time"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isRecording ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'text-zinc-500 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !inputTask.trim()}
                    className="absolute bottom-4 right-4 bg-emerald-500 text-zinc-950 px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? 'Thinking...' : 'Ingest'}
                  </button>
                </form>
              </section>

              {focusTask && (
                <section className="bg-zinc-900/40 backdrop-blur-md border border-emerald-500/30 shadow-lg shadow-emerald-500/5 p-8 rounded-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] -z-10 rounded-full group-hover:bg-emerald-500/20 transition-colors duration-700" />
                  <h2 className="text-xs font-mono tracking-widest uppercase text-emerald-500 mb-6 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" /> Deep Focus
                  </h2>
                  
                  <div className="space-y-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${getPriorityColor(focusTask.priority)}`}>
                      {focusTask.priority}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black leading-tight text-zinc-100">{focusTask.title}</h3>
                    
                    {expandedStepsFor === focusTask.id && focusTask.subTasks && focusTask.subTasks.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Autonomous Task Plan</p>
                        <ul className="space-y-2">
                          {focusTask.subTasks.map((st, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-zinc-300 bg-zinc-950/40 backdrop-blur-md p-3 rounded-lg border border-zinc-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{st}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTaskSteps(focusTask); }}
                      disabled={generatingStepsFor === focusTask.id}
                      className="flex items-center gap-2 mt-6 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs uppercase font-bold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                    >
                      {generatingStepsFor === focusTask.id ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Generating Plan...</>
                      ) : (
                        <><Brain className="w-4 h-4" /> {expandedStepsFor === focusTask.id ? 'Hide plan' : 'How to complete the task'}</>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <button 
                      onClick={() => handleStartFocus(focusTask.id)}
                      className="flex-1 border border-emerald-500/30 py-4 rounded-xl text-xs font-bold uppercase tracking-widest text-emerald-500 hover:bg-emerald-500 hover:text-zinc-950 transition-all flex items-center justify-center gap-2"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Enter Immersive Mode
                    </button>
                    <button 
                      onClick={() => completeTask(focusTask.id)}
                      className="flex-1 bg-zinc-950/40 backdrop-blur-md border border-zinc-800 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:border-zinc-700 transition-all text-zinc-400 hover:text-zinc-200"
                    >
                      Execute & Complete
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* BACKLOG VIEW */}
          {(currentView === 'backlog') && (
            <div className="col-span-1 md:col-span-2 max-w-3xl mx-auto w-full space-y-6 md:space-y-8 order-3">
              <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 relative z-10">
                  <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2 m-0">
                    <AlertTriangle className="w-4 h-4 text-emerald-500" /> Prioritized Backlog
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-zinc-950/40 backdrop-blur-md rounded-lg p-1 border border-zinc-800">
                      {['High', 'Medium', 'Low'].map(p => (
                        <button
                          key={p}
                          onClick={() => setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          className={`px-3 py-1 text-[10px] font-mono rounded-md transition-colors ${filterPriorities.includes(p) ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="flex bg-zinc-950/40 backdrop-blur-md rounded-lg p-1 border border-zinc-800">
                      {['Logistics', 'Performance', 'Marketing', 'Development', 'Personal', 'Other'].map(c => (
                        <button
                          key={c}
                          onClick={() => setFilterCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                          className={`px-3 py-1 text-[10px] font-mono rounded-md transition-colors ${filterCategories.includes(c) ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                  <AnimatePresence>
                    {filteredTasks.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-4 bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors group"
                      >
                        <div className="flex flex-col w-full max-w-[calc(100%-40px)]">
                          <h4 className="font-semibold text-zinc-200 text-sm md:text-base leading-snug pr-4 flex items-center gap-2 mb-2">
                            <span>{task.title}</span>
                            {task.recurring && task.recurring !== 'none' && (
                              <RefreshCw className="w-3 h-3 text-emerald-500/60 shrink-0" />
                            )}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] font-mono">
                            <span className={`px-2 py-1 rounded border ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className="text-zinc-500 flex items-center gap-1 border border-zinc-800 px-2 py-1 rounded bg-zinc-900/40 backdrop-blur-md">
                              <Clock className="w-3 h-3" />
                              {new Date(task.deadline).toLocaleDateString()}
                            </span>
                            {task.estimatedDuration && (
                              <span className="text-zinc-500 flex items-center gap-1 border border-zinc-800 px-2 py-1 rounded bg-zinc-900/40 backdrop-blur-md">
                                <Zap className="w-3 h-3" />
                                {task.estimatedDuration}m
                              </span>
                            )}
                            {task.score && (
                              <span className="text-emerald-500 flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 rounded">
                                <Brain className="w-3 h-3" />
                                Score: {Math.round(task.score)}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTaskSteps(task); }}
                              disabled={generatingStepsFor === task.id}
                              className="flex items-center gap-1.5 px-2 py-1 bg-transparent border border-zinc-800 rounded text-[10px] uppercase font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors font-sans"
                            >
                              {generatingStepsFor === task.id ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Generating...</>
                              ) : (
                                <><Brain className="w-3 h-3" /> {expandedStepsFor === task.id ? 'Hide plan' : 'How to complete'}</>
                              )}
                            </button>
                          </div>

                          {task.aiExplanation && (
                            <div className="flex items-start gap-2 mt-1 mb-2 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                {task.aiExplanation}
                              </p>
                            </div>
                          )}

                          {expandedStepsFor === task.id && task.subTasks && task.subTasks.length > 0 && (
                            <div className="mt-2 space-y-2 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-4 rounded-xl">
                              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">AI Suggested Plan</p>
                              {task.subTasks.map((step, i) => (
                                <div key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">{i+1}.</span> 
                                  <span className="leading-relaxed">{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => completeTask(task.id)}
                          className="p-2 shrink-0 text-zinc-600 hover:text-emerald-500 transition-colors rounded-full hover:bg-zinc-800 mt-1"
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {filteredTasks.length === 0 && (
                    <div className="text-center py-12 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
                      No tasks found.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* SCHEDULE VIEW */}
          {(currentView === 'schedule') && (
            <div className="col-span-1 md:col-span-2 max-w-3xl mx-auto w-full space-y-6 md:space-y-8 order-4">
              <section className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/10 blur-[60px] -z-10 rounded-full group-hover:bg-emerald-500/20 transition-colors duration-700" />
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4 relative z-10">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xs font-mono tracking-widest uppercase text-zinc-500 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-emerald-500" /> AI Schedule
                    </h2>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex bg-zinc-950/40 backdrop-blur-md rounded-lg p-1 border border-zinc-800 shrink-0">
                      {['High', 'Medium', 'Low'].map(p => (
                        <button
                          key={p}
                          onClick={() => setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${filterPriorities.includes(p) ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="flex bg-zinc-950/40 backdrop-blur-md rounded-lg p-1 border border-zinc-800 shrink-0">
                      {['Logistics', 'Performance', 'Marketing', 'Development', 'Personal', 'Other'].map(c => (
                        <button
                          key={c}
                          onClick={() => setFilterCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                          className={`px-2 py-1 text-[10px] font-mono rounded-md transition-colors ${filterCategories.includes(c) ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigateSchedule('prev')} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold tracking-wider text-emerald-500">
                        {scheduleDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <button onClick={() => navigateSchedule('next')} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => setIsAddEventModalOpen(true)}
                      className="text-xs font-bold uppercase tracking-wider text-zinc-400 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex items-center gap-2 bg-zinc-950/40 backdrop-blur-md"
                    >
                      <Plus className="w-3 h-3" /> Add Event
                    </button>
                    <button 
                      onClick={handleGeneratePlan}
                      className="text-xs font-bold uppercase tracking-wider text-emerald-500 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Zap className="w-3 h-3" /> Auto-Plan Day
                    </button>
                    <button 
                      onClick={() => setScheduleViewMode(prev => prev === 'list' ? 'gantt' : 'list')}
                      className="text-xs font-bold uppercase tracking-wider text-zinc-400 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex items-center gap-2 bg-zinc-950/40 backdrop-blur-md"
                    >
                      {scheduleViewMode === 'list' ? <BarChart2 className="w-3 h-3 rotate-90" /> : <AlignLeft className="w-3 h-3" />}
                      {scheduleViewMode === 'list' ? 'Gantt' : 'List'}
                    </button>
                    <button className="text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors">Sync</button>
                  </div>
                </div>
                
                {selectedScheduleItems.length > 0 && (
                  <div className="flex items-center justify-between bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-xl p-3 mb-6 relative z-10 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-400">{selectedScheduleItems.length} selected</span>
                      <button onClick={handleSelectAllScheduleItems} className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors">Select All</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleBulkCompleteScheduleItems} className="text-xs font-bold uppercase tracking-wider text-emerald-500 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" /> Complete
                      </button>
                      <button onClick={handleBulkDeleteScheduleItems} className="text-xs font-bold uppercase tracking-wider text-rose-400 border border-rose-400/30 px-3 py-1.5 rounded-lg hover:bg-rose-400/10 transition-colors flex items-center gap-2">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
                
                {scheduleViewMode === 'list' ? (
                  <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent z-10">
                    {generatedSchedule.length > 0 ? generatedSchedule.map((slot, i) => (
                      <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-6">
                        <div className="flex items-center justify-center w-14 h-14 rounded-full border border-zinc-800 bg-zinc-950/40 backdrop-blur-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          <span className="text-[10px] font-mono text-zinc-400">{slot.time}</span>
                        </div>
                        <div 
                          className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${slot.type === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-zinc-200' : slot.type === 'calendar' ? 'border-indigo-500/30 bg-indigo-500/10 text-zinc-200' : 'border-zinc-800 bg-zinc-950/40 backdrop-blur-md text-zinc-400 hover:border-zinc-700'} ${selectedScheduleItems.some(item => item.id === slot.id && item.source === slot.source) ? 'ring-2 ring-indigo-500/50' : ''}`}
                          onClick={() => toggleScheduleItemSelection(slot.id, slot.source)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold text-sm tracking-wide flex items-center gap-2">
                                <span>{slot.task}</span>
                                {(slot as any).recurring && (slot as any).recurring !== 'none' && (
                                  <RefreshCw className="w-3 h-3 text-emerald-500/60" />
                                )}
                                {slot.priority === 'High' && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10">High</span>}
                                {slot.priority === 'Medium' && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-500 bg-amber-500/10">Medium</span>}
                                {slot.priority === 'Low' && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-sky-500/30 text-sky-400 bg-sky-500/10">Low</span>}
                              </div>
                              {slot.type === 'calendar' && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">Scheduled Event</div>
                                  {slot.category && (
                                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-300 bg-indigo-500/20">
                                      {slot.category}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${selectedScheduleItems.some(item => item.id === slot.id && item.source === slot.source) ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                               {selectedScheduleItems.some(item => item.id === slot.id && item.source === slot.source) && <CheckCircle2 className="w-3 h-3 text-zinc-950" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-12 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-xl mt-8 relative z-10 bg-zinc-950/50">
                        No tasks scheduled for today.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-6 overflow-x-auto min-h-[400px] relative z-10">
                    {(() => {
                      if (generatedSchedule.length === 0) {
                        return <div className="text-center py-12 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-xl mt-8">No tasks scheduled for today.</div>;
                      }
                      
                      const firstTime = Math.min(...generatedSchedule.map(s => s.timestamp));
                      const lastTime = Math.max(...generatedSchedule.map(s => s.endTime));
                      
                      const startHour = new Date(firstTime).getHours();
                      const endHour = new Date(lastTime).getHours() + 1;
                      
                      const minTime = new Date(firstTime).setHours(startHour, 0, 0, 0);
                      const maxTime = new Date(lastTime).setHours(endHour, 0, 0, 0);
                      const duration = maxTime - minTime;
                      ganttContextRef.current = { duration, minTime };

                      const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

                      return (
                        <div id="gantt-container" className="relative w-full min-w-[600px] h-full pt-8">
                          {/* Time markers */}
                          <div className="absolute top-0 left-0 w-full flex text-[10px] font-mono text-zinc-600 border-b border-zinc-800 pb-2">
                            {hours.map(h => (
                              <div key={h} className="relative flex flex-col items-center" style={{ left: `${((h - startHour) * 3600000 / duration) * 100}%`, position: 'absolute', transform: 'translateX(-50%)' }}>
                                <span>{`${h.toString().padStart(2, '0')}:00`}</span>
                                <div className="h-[400px] w-px bg-zinc-800 absolute top-full mt-2 pointer-events-none" />
                              </div>
                            ))}
                          </div>

                          {/* Gantt Bars */}
                          <div className="mt-6 space-y-3 relative z-10">
                            {generatedSchedule.map((slot, i) => {
                              const isTemp = tempGanttState?.id === slot.id && tempGanttState?.source === slot.source;
                              const effectiveStart = isTemp ? tempGanttState.newStart : slot.timestamp;
                              const effectiveEnd = isTemp ? tempGanttState.newEnd : slot.endTime;

                              const leftPercent = ((effectiveStart - minTime) / duration) * 100;
                              const widthPercent = ((effectiveEnd - effectiveStart) / duration) * 100;
                              
                              const isSelected = selectedScheduleItems.some(item => item.id === slot.id && item.source === slot.source);
                              
                              return (
                                <div 
                                  key={i} 
                                  className={`relative h-12 rounded-lg border backdrop-blur-sm shadow-sm transition-all flex items-center group ${slot.type === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-zinc-200' : slot.type === 'calendar' ? 'border-indigo-500/30 bg-indigo-500/10 text-zinc-200' : 'border-zinc-800 bg-zinc-950/40 backdrop-blur-md text-zinc-400 hover:border-zinc-700'} ${isSelected ? 'ring-2 ring-indigo-500/50' : ''} ${isTemp ? 'opacity-80 scale-[1.02] z-50 cursor-grabbing' : 'cursor-pointer hover:scale-[1.01]'}`}
                                  style={{
                                    marginLeft: `${leftPercent}%`,
                                    width: `${Math.max(widthPercent, 2)}%`,
                                  }}
                                >
                                  {/* Resize Start Handle */}
                                  <div 
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-zinc-700/50 transition-colors z-20"
                                    onPointerDown={(e) => handleGanttPointerDown(e, slot, 'resize-start')}
                                  />
                                  
                                  {/* Drag Handle (Body) */}
                                  <div 
                                    className="flex-1 flex items-center justify-between px-3 w-full h-full cursor-grab active:cursor-grabbing z-10"
                                    onPointerDown={(e) => handleGanttPointerDown(e, slot, 'move')}
                                    onClick={() => toggleScheduleItemSelection(slot.id, slot.source)}
                                  >
                                    <div className="truncate text-xs font-semibold pr-2 flex items-center gap-2">
                                      <span className="truncate">{slot.task}</span>
                                      {(slot as any).recurring && (slot as any).recurring !== 'none' && (
                                        <RefreshCw className="w-3 h-3 text-emerald-500/60 shrink-0" />
                                      )}
                                      {slot.priority === 'High' && <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded border border-rose-500/30 text-rose-400 bg-rose-500/10">High</span>}
                                      {slot.priority === 'Medium' && <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded border border-amber-500/30 text-amber-500 bg-amber-500/10">Medium</span>}
                                      {slot.priority === 'Low' && <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded border border-sky-500/30 text-sky-400 bg-sky-500/10">Low</span>}
                                    </div>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                                       {isSelected && <CheckCircle2 className="w-2.5 h-2.5 text-zinc-950" />}
                                    </div>
                                  </div>
                                  
                                  {/* Resize End Handle */}
                                  <div 
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-zinc-700/50 transition-colors z-20"
                                    onPointerDown={(e) => handleGanttPointerDown(e, slot, 'resize-end')}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>
            </div>
          )}

        </div>
      </main>

      {/* Smart Suggestions Modal */}
      <AnimatePresence>
        {isAddEventModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950/40 backdrop-blur-md border border-indigo-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -z-10 rounded-full" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-mono tracking-widest uppercase text-indigo-400 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" /> Add Event
                </h2>
                <button 
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Event Title</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g., Team Sync"
                    className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Event Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Start Time</label>
                    <input
                      type="time"
                      value={newEventStart}
                      onChange={(e) => setNewEventStart(e.target.value)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">End Time</label>
                    <input
                      type="time"
                      value={newEventEnd}
                      onChange={(e) => setNewEventEnd(e.target.value)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Category</label>
                    <select
                      value={newEventCategory}
                      onChange={(e) => setNewEventCategory(e.target.value)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      <option value="Logistics">Logistics</option>
                      <option value="Performance">Performance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Development">Development</option>
                      <option value="Personal">Personal</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Priority</label>
                    <select
                      value={newEventPriority}
                      onChange={(e) => setNewEventPriority(e.target.value)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider">Repeat</label>
                    <select
                      value={newEventRecurring}
                      onChange={(e) => setNewEventRecurring(e.target.value as any)}
                      className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full mt-6 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors"
                >
                  Save Event
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPlanningModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950/40 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] -z-10 rounded-full" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-mono tracking-widest uppercase text-emerald-500 flex items-center gap-2">
                  <Brain className="w-5 h-5" /> Smart Day Plan
                </h2>
                <button 
                  onClick={() => setIsPlanningModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="min-h-[200px] max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-4 text-zinc-300 leading-relaxed text-sm">
                {isPlanning ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest animate-pulse">Analyzing schedule...</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{planningResult}</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {isSettingsModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/10 blur-[80px] -z-10 rounded-full" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-mono tracking-widest uppercase text-zinc-100 flex items-center gap-2">
                  <Target className="w-5 h-5" /> Account Settings
                </h2>
                <button 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 p-[2px] shrink-0">
                    <div className="w-full h-full bg-zinc-950/40 backdrop-blur-md rounded-full flex items-center justify-center overflow-hidden">
                      <User className="w-8 h-8 text-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-zinc-100 tracking-tight">Alex Vance</div>
                    <div className="text-xs font-mono text-zinc-500 mt-0.5">alex.vance@taskpulse.com</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-500 tracking-wider mb-2 block">Display Name</label>
                    <input type="text" defaultValue="Alex Vance" className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-500 tracking-wider mb-2 block">Email Address</label>
                    <input type="email" defaultValue="alex.vance@taskpulse.com" className="w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase text-zinc-500 tracking-wider mb-2 block">Push Notifications</label>
                    <button 
                      type="button"
                      onClick={handleEnablePushNotifications}
                      className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors"
                    >
                      <span className="text-sm text-zinc-400">Enable Web Push Notifications</span>
                      <BellRing className="w-4 h-4 text-emerald-500" />
                    </button>
                    <p className="text-[10px] text-zinc-600 mt-1.5 px-1 font-mono">
                      Receive task reminders and updates directly on your device.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800">
                  <button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => { setIsSettingsModalOpen(false); showToast('Settings saved successfully'); }} className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 transition-colors">
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Notifications Modal */}
        {isNotificationsModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-950/40 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/10 blur-[80px] -z-10 rounded-full" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-mono tracking-widest uppercase text-zinc-100 flex items-center gap-2">
                  <BellRing className="w-5 h-5" /> Notifications
                </h2>
                <button 
                  onClick={() => setIsNotificationsModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-zinc-600 text-sm font-mono border border-zinc-800 rounded-xl">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        notif.type === 'goal' ? 'bg-emerald-500/10 text-emerald-500' :
                        notif.type === 'alert' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {notif.type === 'goal' ? <Target className="w-5 h-5" /> : 
                         notif.type === 'alert' ? <BellRing className="w-5 h-5" /> : 
                         <CalendarDays className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-200">{notif.title}</div>
                        <div className="text-xs text-zinc-400 mt-1">{notif.message}</div>
                        <div className="text-[10px] font-mono text-zinc-600 mt-2">
                          {(() => {
                            const diff = Math.max(0, Date.now() - notif.time);
                            const m = Math.floor(diff / 60000);
                            const h = Math.floor(m / 60);
                            const d = Math.floor(h / 24);
                            if (d > 0) return `${d} DAY${d > 1 ? 'S' : ''} AGO`;
                            if (h > 0) return `${h} HOUR${h > 1 ? 'S' : ''} AGO`;
                            if (m > 0) return `${m} MIN AGO`;
                            return 'JUST NOW';
                          })()}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {notifications.length > 0 && (
                  <div className="pt-4 flex justify-center border-t border-zinc-800">
                    <button onClick={() => setIsNotificationsModalOpen(false)} className="px-4 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImmersiveMode && focusTask && (
          <ImmersiveFocusMode
            task={focusTask}
            onClose={() => {
              setIsImmersiveMode(false);
              showToast('Exited Deep Focus Mode', 'info');
            }}
            onComplete={() => {
              completeTask(focusTask.id);
              setIsImmersiveMode(false);
            }}
          />
        )}
      </AnimatePresence>

      <ToastContainer />
      <Chatbot tasks={tasks} habits={habits} />
    </div>
  );
}
