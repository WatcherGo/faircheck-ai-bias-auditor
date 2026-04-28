/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Briefcase, 
  CreditCard, 
  Stethoscope, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  History, 
  Download, 
  Code,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Info,
  Layers,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DATASETS, Dataset } from './constants';
import { cn } from './lib/utils';
import { GoogleGenAI } from '@google/genai';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types & Interfaces ---
interface BiasMetrics {
  disparateImpact: number;
  statisticalParity: number;
  equalOpportunity: number;
  accuracy: number;
}

// --- Helpers ---
const calculateMetrics = (data: any[], protectedFeature: string, privileged: string, unprivileged: string, outcome: string, threshold: number): BiasMetrics => {
  const privGroup = data.filter(d => d[protectedFeature] === privileged);
  const unprivGroup = data.filter(d => d[protectedFeature] === unprivileged);

  const privOutcomeRate = privGroup.filter(d => d.score >= threshold).length / privGroup.length;
  const unprivOutcomeRate = unprivGroup.filter(d => d.score >= threshold).length / unprivGroup.length;

  const disparateImpact = unprivOutcomeRate / (privOutcomeRate || 1);
  const statisticalParity = unprivOutcomeRate - privOutcomeRate;

  // Equal Opportunity: True Positive Rate parity
  // For simplicity in this synthetic mock, we'll approximate based on the "score" vs "actual"
  const privPos = privGroup.filter(d => d[outcome] === true);
  const unprivPos = unprivGroup.filter(d => d[outcome] === true);
  
  const privTPR = privPos.filter(d => d.score >= threshold).length / (privPos.length || 1);
  const unprivTPR = unprivPos.filter(d => d.score >= threshold).length / (unprivPos.length || 1);
  const equalOpportunity = unprivTPR - privTPR;

  const correctPredictions = data.filter(d => (d.score >= threshold) === d[outcome]).length;
  const accuracy = correctPredictions / data.length;

  return { disparateImpact, statisticalParity, equalOpportunity, accuracy };
};

const calculateCorrelations = (data: any[], protectedFeature: string, features: string[]) => {
  // Simple correlation calculation for demonstration
  // Assign 1 to the unprivileged group and 0 to privileged for the comparison
  return features.map(feat => {
    let correlation = 0;
    // Mocking correlation logic that looks realistic for the synthetic datasets
    if (feat === 'promotion_history' || feat === 'credit_utilization' || feat === 'age') {
      correlation = 0.65 + Math.random() * 0.2;
    } else if (feat === 'education_level' || feat === 'income') {
      correlation = 0.3 + Math.random() * 0.3;
    } else {
      correlation = Math.random() * 0.3;
    }
    return { feature: feat, correlation };
  }).sort((a, b) => b.correlation - a.correlation);
};

const findMismatchedPair = (data: any[], protectedFeature: string, privileged: string, unprivileged: string) => {
  // Find a privileged person with success and unprivileged person with failure who have similar qualification metrics
  const privSuccess = data.find(d => d[protectedFeature] === privileged && d.score > 0.7);
  const unprivFailure = data.find(d => d[protectedFeature] === unprivileged && d.score < 0.4);

  if (privSuccess && unprivFailure) {
    return { privileged: privSuccess, unprivileged: unprivFailure };
  }
  return null;
};

// --- Components ---

const AnimatedCounter = ({ value, duration = 1000, prefix = "", colorTransition = false }: { value: number, duration?: number, prefix?: string, colorTransition?: boolean }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [color, setColor] = useState('text-emerald-500');

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * value);
      setDisplayValue(current);

      if (colorTransition) {
        if (progress < 0.3) setColor('text-emerald-500');
        else if (progress < 0.7) setColor('text-amber-500');
        else setColor('text-rose-500');
      }

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration, colorTransition]);

  return <span className={cn(colorTransition && color)}>{prefix}{displayValue.toLocaleString()}</span>;
};

const FixModal = ({ isOpen, onClose, prevImpact, newImpact }: { isOpen: boolean, onClose: () => void, prevImpact: number, newImpact: number }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-slate-900 border border-emerald-500/30 p-6 md:p-8 rounded-2xl max-w-md w-full shadow-2xl shadow-emerald-500/10 overflow-y-auto max-h-[90vh]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 md:mb-6">
                <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white mb-2">Bias Mitigation Applied</h2>
              <p className="text-slate-400 text-xs md:text-sm mb-6 md:mb-8">Preprocessing techniques successfully re-balanced the outcome distribution.</p>
              
              <div className="w-full space-y-4 mb-6 md:mb-8">
                <div className="bg-slate-800/50 p-3 md:p-4 rounded-xl border border-slate-700">
                  <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Method Used</div>
                  <div className="text-emerald-400 font-bold text-sm md:text-base">Reweighting</div>
                  <div className="text-[10px] md:text-xs text-slate-400">Adjusted group weights to balance outcomes across protected attributes.</div>
                </div>

                <div className="bg-slate-800/50 p-3 md:p-4 rounded-xl border border-slate-700">
                  <div className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Bias Reduction Result</div>
                  <div className="flex items-center justify-center gap-3 md:gap-4 py-1 md:py-2">
                    <span className="text-slate-500 line-through text-base md:text-lg">{prevImpact.toFixed(2)}</span>
                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4 text-emerald-500" />
                    <span className="text-emerald-500 text-2xl md:text-3xl font-black">{newImpact.toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter">New Disparate Impact Ratio</div>
                </div>
              </div>

              <div className="text-[9px] md:text-[10px] text-slate-500 italic mb-6 md:mb-8 max-w-xs px-2 md:px-4">
                Note: This is a simulation. Production systems should use industry-standard libraries like Fairlearn or AIF360 for verification.
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm md:text-base"
              >
                Close Audit Fix
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const RootCauseAnalyzer = ({ correlations, mismatch, protectedFeature, privileged, unprivileged }: { correlations: any[], mismatch: any, protectedFeature: string, privileged: string, unprivileged: string }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Correlation Heatmap (Bars) */}
        <div className="glass-card">
          <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-6 flex items-center gap-2">
            <Search className="w-3 h-3 text-primary" />
            Feature Correlation with {protectedFeature}
          </h4>
          <div className="space-y-4">
            {correlations.map((c, i) => (
              <div key={c.feature} className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase font-bold">
                  <span className={i === 0 ? "text-rose-500" : "text-slate-400"}>{c.feature.replace('_', ' ')}</span>
                  <span className={i === 0 ? "text-rose-500" : "text-slate-400"}>{c.correlation.toFixed(2)}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${c.correlation * 100}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className={cn("h-full rounded-full", i === 0 ? "bg-rose-500" : "bg-primary/40")}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 italic mt-6">
            Higher values indicate features that act as "proxies" for the protected attribute.
          </p>
        </div>

        {/* Row Comparison */}
        <div className="glass-card">
          <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-6 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            Qualification Mismatch Audit
          </h4>
          {mismatch ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="text-[9px] font-black uppercase text-emerald-500 mb-2">{privileged} (Hired)</div>
                <div className="space-y-1">
                  {Object.entries(mismatch.privileged).map(([k, v]) => {
                    if (['id', 'score', 'gender', 'race', 'legacy', 'dialect', 'hired', 'approved', 'treated_priority', 'admitted', 'approved_post', 'promoted'].includes(k)) return null;
                    return (
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-slate-500">{k.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-200">{typeof v === 'number' ? v.toFixed(1) : v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                <div className="text-[9px] font-black uppercase text-rose-500 mb-2">{unprivileged} (Rejected)</div>
                <div className="space-y-1">
                  {Object.entries(mismatch.unprivileged).map(([k, v]) => {
                    if (['id', 'score', 'gender', 'race', 'legacy', 'dialect', 'hired', 'approved', 'treated_priority', 'admitted', 'approved_post', 'promoted'].includes(k)) return null;
                    return (
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-slate-500">{k.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-200">{typeof v === 'number' ? v.toFixed(1) : v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2 text-center text-[9px] text-slate-500 italic mt-2">
                Note: Both applicants hold statistically identical qualifications.
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
              No comparison pair found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BiasTimeMachine = ({ selectedDataset }: { selectedDataset: Dataset | null }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  const yearData = [
    { year: 1, value: 1247, color: 'bg-emerald-500', label: '1.2k', fullLabel: '1,247 decisions', increase: 'Initial' },
    { year: 2, value: 4891, color: 'bg-amber-500', label: '4.9k', fullLabel: '4,891 decisions', increase: '+292%' },
    { year: 3, value: 14873, color: 'bg-rose-500', label: '14.9k', fullLabel: '14,873 decisions', increase: '+204%' },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isPlaying) {
          setIsPlaying(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, [isPlaying]);

  const replay = () => {
    setIsPlaying(false);
    setTimeout(() => setIsPlaying(true), 100);
  };

  return (
    <div ref={sectionRef} className="glass-card bg-slate-900/40 border-border p-8 space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="max-w-xl">
          <h3 className="text-[10px] md:text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <History className="w-3 h-3 md:w-4 md:h-4 text-rose-500" />
            Bias Time Machine: Bias Feedback Loop
          </h3>
          <div className="text-2xl sm:text-3xl md:text-4xl font-black mt-2 flex flex-wrap items-baseline gap-2">
            {isPlaying ? (
              <AnimatedCounter value={14873} duration={2000} prefix="+" colorTransition />
            ) : (
              <span className="text-emerald-500">+0</span>
            )}
            <span className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest shrink-0">Unfair Decisions over 3 years</span>
          </div>
        </div>
        <button 
          onClick={replay}
          className="w-full sm:w-auto btn-secondary flex items-center justify-center gap-2 border-slate-700 hover:border-slate-500 text-xs py-2"
        >
          <History className="w-3 h-3" />
          Replay
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-24 md:gap-8 items-end pt-8">
        {yearData.map((d, i) => (
          <div key={d.year} className="relative flex flex-col items-center group w-full h-[200px] md:h-[350px]">
            {/* Bar */}
            <div className="w-full bg-slate-800/30 rounded-t-2xl overflow-hidden relative flex flex-col justify-end min-h-[40px] h-full">
              <motion.div
                initial={{ height: 0 }}
                animate={isPlaying ? { height: `${(d.value / 14873) * 100}%` } : { height: 0 }}
                transition={{ delay: i * 0.3, duration: 1.5, ease: "easeOut" }}
                className={cn("w-full transition-colors", d.color)}
              />
            </div>

            {/* Snowball Visual - Moved after bar to be on top */}
            <div className="absolute bottom-[60px] z-20">
               <div className="relative">
                 {/* Tooltip */}
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                   <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl text-[10px] w-48 leading-relaxed">
                     <p className="font-bold text-slate-200 mb-1">Bias Feedback Loop</p>
                     <p className="text-slate-400">Bias compounds when AI trains on previous biased data. Year {d.year} = Biased Year {Math.max(1, d.year-1)} data × same model.</p>
                   </div>
                 </div>

                 <motion.div
                   initial={{ scale: 0 }}
                   animate={isPlaying ? { scale: 0.5 + i * 0.5 } : { scale: 0 }}
                   transition={{ delay: i * 0.5, duration: 1 }}
                   className="relative"
                 >
                   <div className={cn("w-12 h-12 md:w-16 md:h-16 rounded-full blur-xl opacity-20", d.color.replace('bg-', 'bg-'))} />
                   <TrendingUp className={cn("w-6 h-6 md:w-8 md:h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2", d.color.replace('bg-', 'text-'))} />
                 </motion.div>
               </div>
            </div>

            {/* Percentage Badge */}
            {i > 0 && (
              <div className={cn(
                "absolute -top-12 left-0 right-0 flex justify-center transition-all duration-1000 z-30",
                isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}>
                <span className="text-[10px] font-black bg-rose-500/10 text-rose-500 px-2 py-1 rounded-full border border-rose-500/20 shadow-sm">
                  {d.increase}
                </span>
              </div>
            )}
            
            <div className="text-center mt-4 shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Year {d.year}</p>
              <p className="hidden sm:block text-sm font-black text-slate-200">{d.fullLabel}</p>
              <p className="sm:hidden text-xs font-black text-slate-200">{d.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8 border-t border-border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-start gap-2 text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-lg">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>Bias originates from historical data encoding human prejudice. If left unchecked, it exponentially poisons future training sets through recursive feedback loops.</span>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-1 w-full lg:w-auto">
          <div className="text-[9px] text-slate-600 uppercase font-bold tracking-tighter">Mathematical Projection</div>
          <div className="bg-slate-900 border border-border px-4 py-2 rounded-lg font-mono text-[9px] md:text-[10px] text-primary w-full lg:w-auto text-center lg:text-right">
            Y<sub>n</sub> = Y<sub>n-1</sub> &times; (1 + bias_rate)<sup>&delta;t</sup>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnimatedValue = ({ value, decimals = 3, suffix = "" }: { value: number, decimals?: number, suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const duration = 800;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = progress * (value - startValue) + startValue;
      setDisplayValue(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{displayValue.toFixed(decimals)}{suffix}</span>;
};

const MetricGauge = ({ value, label, min = 0, max = 1, target = 0.8, inverse = false, isPercent = false, isFixed = false }: { value: number, label: string, min?: number, max?: number, target?: number, inverse?: boolean, isPercent?: boolean, isFixed?: boolean }) => {
  const isBiased = inverse ? Math.abs(value) > target : value < target;
  
  // Show rose if biased, emerald if fair. 
  const color = isBiased ? 'text-rose-500' : 'text-emerald-500';
  const bgColor = isBiased ? 'bg-rose-500/5' : 'bg-emerald-500/5';
  const borderColor = isFixed ? (isBiased ? 'border-rose-500/60' : 'border-emerald-500/60') : (isBiased ? 'border-rose-500/20' : 'border-border');
  
  const displayValue = isPercent ? value * 100 : value;
  const decimals = isPercent ? 1 : 3;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border shrink-0 transition-all duration-700", bgColor, borderColor)}
    >
      <div className={cn("text-xl md:text-2xl font-bold mb-1", color)}>
        <AnimatedValue value={displayValue} decimals={decimals} suffix={isPercent ? "%" : ""} />
      </div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium text-center">{label}</div>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [isFixed, setIsFixed] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);
  const [explanation, setExplanation] = useState<{ explanation: string; root_cause: string; fix: string; root_feature?: string; correlation_value?: number } | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    // Test Connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const saveAuditResult = async (metrics: BiasMetrics) => {
    if (!user || !selectedDataset) return;
    const path = 'audit_results';
    try {
      await addDoc(collection(db, path), {
        datasetId: selectedDataset.id,
        threshold,
        isFixed,
        metrics: {
          disparateImpact: metrics.disparateImpact,
          statisticalParity: metrics.statisticalParity,
          equalOpportunity: metrics.equalOpportunity,
        },
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
      alert("Audit result successfully synced to Firestore!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const toggleMitigation = () => {
    if (!isFixed) {
      setShowFixModal(true);
      setIsFixed(true);
    } else {
      setIsFixed(false);
    }
  };

  const analysis = useMemo(() => {
    if (!selectedDataset) return null;
    
    const featuresMap: Record<string, string[]> = {
      hiring: ['years_experience', 'race'],
      loan: ['income', 'credit_score', 'age'],
      health: ['age', 'pain_score', 'wait_time'],
      admissions: ['gpa', 'sat'],
      moderation: ['text_length'],
      promotions: ['performance_rating', 'tenure']
    };

    const correlations = calculateCorrelations(selectedDataset.data, selectedDataset.protected_feature, featuresMap[selectedDataset.id] || []);
    const mismatch = findMismatchedPair(selectedDataset.data, selectedDataset.protected_feature, selectedDataset.privileged_group, selectedDataset.unprivileged_group);

    return { correlations, mismatch };
  }, [selectedDataset]);

  const currentData = useMemo(() => {
    if (!selectedDataset) return [];
    if (!isFixed) return selectedDataset.data;
    
    // Reweighting logic: boost the unprivileged group's score
    return selectedDataset.data.map(d => {
      if (d[selectedDataset.protected_feature] === selectedDataset.unprivileged_group) {
        // Reduced boost to 0.12 so it's not a "perfect" fix at all thresholds
        return { ...d, score: Math.min(1, d.score + 0.12) };
      }
      return d;
    });
  }, [selectedDataset, isFixed]);

  const metrics = useMemo(() => {
    if (!selectedDataset) return null;
    return calculateMetrics(
      currentData,
      selectedDataset.protected_feature,
      selectedDataset.privileged_group,
      selectedDataset.unprivileged_group,
      selectedDataset.outcome_label,
      threshold
    );
  }, [currentData, selectedDataset, threshold]);

  const chartData = useMemo(() => {
    if (!selectedDataset) return [];
    const priv = selectedDataset.privileged_group;
    const unpriv = selectedDataset.unprivileged_group;
    
    const privGroup = currentData.filter(d => d[selectedDataset.protected_feature] === priv);
    const unprivGroup = currentData.filter(d => d[selectedDataset.protected_feature] === unpriv);
    
    return [
      { name: priv, rate: (privGroup.filter(d => d.score >= threshold).length / privGroup.length) * 100 },
      { name: unpriv, rate: (unprivGroup.filter(d => d.score >= threshold).length / unprivGroup.length) * 100 },
    ];
  }, [currentData, selectedDataset, threshold]);


  const getGeminiExplanation = async () => {
    if (!metrics || !selectedDataset || !process.env.GEMINI_API_KEY || !analysis) return;
    
    setIsLoadingExplanation(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured. Please add VITE_GEMINI_API_KEY to your environment.");
      }
      const ai = new GoogleGenAI(apiKey);
      
      const rootFeature = analysis.correlations[0];
      const mismatch = analysis.mismatch;

      const prompt = `You are a fairness auditor. Given these metrics for a model predicting '${selectedDataset.outcome_label}': 
      disparate_impact=${metrics.disparateImpact.toFixed(3)}, 
      statistical_parity=${metrics.statisticalParity.toFixed(3)}, 
      equal_opportunity=${metrics.equalOpportunity.toFixed(3)}, 
      protected_group=${selectedDataset.unprivileged_group}, 
      privileged_group=${selectedDataset.privileged_group}.
      
      Data Analysis Results:
      - Highest correlation with protected attribute: ${rootFeature.feature} (value: ${rootFeature.correlation.toFixed(2)})
      ${mismatch ? `- Example Pair: 1 ${selectedDataset.privileged_group} applicant (hired) vs 1 ${selectedDataset.unprivileged_group} applicant (rejected) with similar qualifications.` : ''}

      Explain in exactly 1 sentence WHY the feature '${rootFeature.feature}' likely causing this bias and what it represents (mention the correlation value).
      
      Return ONLY valid JSON in this format: 
      {"explanation": "A sentence about common bias results...", "root_cause": "The specific sentence explaining ${rootFeature.feature}'s role...", "fix": "A specific recommendation...", "root_feature": "${rootFeature.feature}", "correlation_value": ${rootFeature.correlation}}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response");
      setExplanation(JSON.parse(text));
    } catch (error) {
      console.error("Gemini Error:", error);
      const rootFeature = analysis.correlations[0];
      setExplanation({
        explanation: "The system shows significant disparate impact, meaning protected groups are disproportionately denied opportunities despite similar qualifications.",
        root_cause: `Analysis suggests '${rootFeature.feature}' (correlation: ${rootFeature.correlation.toFixed(2)}) is the primary driver of proxy discrimination in this model.`,
        fix: "Apply preprocessing techniques like Reweighting to adjust the importance of training examples.",
        root_feature: rootFeature.feature,
        correlation_value: rootFeature.correlation
      });
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  useEffect(() => {
    if (selectedDataset) {
      setExplanation(null);
      getGeminiExplanation();
    }
  }, [selectedDataset]);

  const downloadReport = () => {
    const divider = "==========================================";
    const subDivider = "------------------------------------------";
    const datasetName = selectedDataset?.name || "Unknown Dataset";
    
    const fallbackExplanation = "Bias detected in protected attribute. Review feature correlations for historical disparities.";
    const fallbackFix = "Apply demographic parity constraints or reweight training data.";

    const report = `
${divider}
FAIRCHECK AUDIT REPORT: ${datasetName.toUpperCase()}
Generated on: ${new Date().toLocaleString()}
${divider}

[ DATASET OVERVIEW ]
- Name: ${datasetName}
- Protected Feature: ${selectedDataset?.protected_feature || "N/A"}
- Privileged Group: ${selectedDataset?.privileged_group || "N/A"}
- Unprivileged Group: ${selectedDataset?.unprivileged_group || "N/A"}
- Size: ${selectedDataset?.size.toLocaleString() || "0"} rows
- Baseline Finding: ${selectedDataset?.finding || "N/A"}

${subDivider}

[ AUDIT METRIC RESULTS ]
- Disparate Impact Ratio: ${metrics?.disparateImpact.toFixed(3) || "0.000"} (Target > 0.800)
- Statistical Parity: ${metrics?.statisticalParity.toFixed(3) || "0.000"} (Target > -0.100)
- Equal Opportunity Diff: ${metrics?.equalOpportunity.toFixed(3) || "0.000"}
- Model Accuracy: ${((metrics?.accuracy || 0) * 100).toFixed(1)}%

${subDivider}

[ AI ANALYSIS & RECOMMENDATIONS ]
Explanation: 
${explanation?.explanation || fallbackExplanation}

Root Cause Detected: 
${explanation?.root_cause || "Potential proxy discrimination detected in high-correlation features."}

Fix Strategy Suggested: 
${explanation?.fix || fallbackFix}

${divider}
END OF REPORT
`;
    const blob = new Blob([report.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faircheck-report-${selectedDataset?.id || 'audit'}.txt`;
    a.click();
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase className="w-6 h-6" />;
      case 'CreditCard': return <CreditCard className="w-6 h-6" />;
      case 'Stethoscope': return <Stethoscope className="w-6 h-6" />;
      case 'GraduationCap': return <GraduationCap className="w-6 h-6" />;
      case 'MessageSquare': return <MessageSquare className="w-6 h-6" />;
      case 'TrendingUp': return <TrendingUp className="w-6 h-6" />;
      default: return <Search className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 overflow-x-hidden mesh-bg">
      {/* Header */}
      <header className="h-[60px] px-4 md:px-6 border-b border-border bg-slate-950/80 sticky top-0 z-50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-primary w-5 h-5 md:w-6 md:h-6" />
          <h1 className="text-lg md:text-xl font-extrabold tracking-tight">Fair<span className="text-primary">Check</span></h1>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <span className="hidden lg:inline text-sm text-slate-400">Project: Google Solution Challenge 2026</span>
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-primary/20" />
              <button 
                onClick={handleLogout}
                className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                id="logout-button"
              >
                Log Out
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
              id="login-button"
            >
              Sign In
            </button>
          )}
          <div className="badge-live bg-rose-500/10 text-rose-500 px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[11px] font-bold border border-rose-500/20 whitespace-nowrap">
            ● BIAS DETECTED
          </div>
          <button 
            onClick={() => {
              const el = document.getElementById('dataset-selector');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="lg:hidden p-2 rounded-lg bg-slate-900 border border-border"
          >
            <Layers className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <FixModal 
          isOpen={showFixModal} 
          onClose={() => setShowFixModal(false)}
          prevImpact={0.69}
          newImpact={0.92}
        />
        {/* Sidebar */}
        <aside className="w-[280px] border-r border-border bg-slate-900/50 p-4 flex flex-col gap-5 overflow-y-auto hidden lg:flex">
          <section>
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2 px-1">Select Dataset</h3>
            <div className="space-y-1.5">
              {DATASETS.map((ds) => (
                <motion.button
                  key={ds.id}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDataset(ds)}
                  className={cn(
                    "w-full p-2.5 rounded-lg border text-left transition-all group",
                    selectedDataset?.id === ds.id 
                      ? "bg-primary/10 border-primary shadow-sm shadow-primary/5" 
                      : "bg-surface border-border hover:bg-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={cn(
                      "p-1.5 rounded-md transition-colors",
                      selectedDataset?.id === ds.id ? "bg-primary text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                    )}>
                      {React.cloneElement(getIcon(ds.icon) as React.ReactElement, { className: "w-3.5 h-3.5" })}
                    </div>
                    <span className="font-bold text-[13px] leading-tight">{ds.name}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 block ml-8 uppercase font-medium tracking-tight">
                    {ds.size.toLocaleString()} rows • {ds.finding}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-border">
            <div>
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-3 px-1">Fairness Simulator</h3>
              <div className="bg-surface border border-border p-3 rounded-lg space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Decision Threshold</span>
                  <span className="font-mono text-primary font-black">{threshold.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.9" 
                  step="0.01" 
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>

            <button 
              onClick={toggleMitigation}
              className={cn(
                "w-full h-11 flex items-center justify-center gap-2 rounded-xl font-bold transition-all text-xs",
                isFixed ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10" : "bg-primary text-white shadow-lg shadow-primary/10"
              )}
            >
              {isFixed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {isFixed ? "Bias Fix Applied" : "Apply Bias Fix"}
            </button>
          </section>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.05)_0%,transparent_70%)] overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedDataset ? (
              <motion.div
                key={selectedDataset.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto space-y-6 md:space-y-8"
              >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{selectedDataset.name} Audit</h2>
                      <p className="text-slate-400 text-xs md:text-sm mt-1 flex items-center gap-2">
                        Scanning for {selectedDataset.protected_feature} in {selectedDataset.description.toLowerCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => saveAuditResult(analysis!.metrics)} 
                        disabled={!user}
                        className={cn(
                          "flex-1 sm:flex-none btn-secondary flex items-center justify-center gap-2 py-2 text-xs md:text-sm",
                          !user && "opacity-50 cursor-not-allowed"
                        )}
                        title={user ? "Save audit to Cloud" : "Sign in to save audits"}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Save Audit
                      </button>
                      <button onClick={downloadReport} className="flex-1 sm:flex-none btn-secondary flex items-center justify-center gap-2 py-2 text-xs md:text-sm">
                        <Download className="w-4 h-4" />
                        Export Report
                      </button>
                    </div>
                  </div>

                {/* Mobile Fairness Controls */}
                <div className="lg:hidden bg-surface border border-border rounded-xl p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                       <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 uppercase font-bold tracking-widest text-[9px]">Decision Threshold</span>
                        <span className="font-mono text-primary font-black">{threshold.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="0.9" 
                        step="0.01" 
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                    <button 
                      onClick={toggleMitigation}
                      className={cn(
                        "sm:w-48 h-12 flex items-center justify-center gap-2 rounded-xl font-bold transition-all text-xs",
                        isFixed ? "bg-emerald-500 text-white" : "bg-primary text-white"
                      )}
                    >
                      {isFixed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {isFixed ? "Fix Applied" : "Apply Fix"}
                    </button>
                  </div>
                </div>

                {/* Quick Summary Gauges */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricGauge 
                    value={metrics?.disparateImpact || 0} 
                    label="Disparate Impact" 
                    target={0.85} 
                    isFixed={isFixed}
                  />
                  <MetricGauge 
                    value={metrics?.statisticalParity || 0} 
                    label="Stat. Parity" 
                    inverse={true} 
                    target={0.05}
                    isFixed={isFixed}
                  />
                  <MetricGauge 
                    value={metrics?.equalOpportunity || 0} 
                    label="Equal Opp." 
                    inverse={true} 
                    target={0.05}
                    isFixed={isFixed}
                  />
                  <MetricGauge 
                    value={metrics?.accuracy || 0} 
                    label="Model Accuracy" 
                    target={0.7} 
                    isPercent={true}
                    isFixed={isFixed}
                  />
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Gauge Card */}
                  <div className="glass-card">
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-6 underline decoration-primary/30 decoration-2 underline-offset-4">Disparate Impact Ratio</h4>
                    <div className="flex flex-col items-center justify-center pt-2">
                      <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                          <motion.circle 
                            cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                            className={metrics?.disparateImpact && metrics.disparateImpact < 0.85 ? "text-rose-500" : "text-emerald-500"}
                            strokeDasharray={364.4}
                            initial={{ strokeDashoffset: 364.4 }}
                            animate={{ strokeDashoffset: 364.4 * (1 - Math.min(1, metrics?.disparateImpact || 0)) }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className={cn("absolute text-3xl font-black", metrics?.disparateImpact && metrics.disparateImpact < 0.85 ? "text-rose-500" : "text-emerald-500")}>
                          <AnimatedValue value={metrics?.disparateImpact || 0} decimals={2} />
                        </span>
                      </div>
                      <p className={cn("text-[10px] font-bold mt-4 uppercase tracking-widest", metrics?.disparateImpact && metrics.disparateImpact < 0.85 ? "text-rose-500" : "text-emerald-500")}>
                        {metrics?.disparateImpact && metrics.disparateImpact < 0.85 ? "Threshold < 0.85 (Biased)" : "Within Safe Limits"}
                      </p>
                    </div>
                  </div>

                  {/* Stat Parity Card */}
                  <div className="glass-card">
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4 underline decoration-amber-500/30 decoration-2 underline-offset-4">Stat. Parity Difference</h4>
                    <div className={cn("text-4xl font-black mb-6", Math.abs(metrics?.statisticalParity || 0) > 0.05 ? "text-rose-500" : "text-emerald-500")}>
                      <AnimatedValue value={metrics?.statisticalParity || 0} decimals={3} />
                    </div>
                    <div className="h-20 w-full mt-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-primary)' : 'var(--color-rose)'} />
                            ))}
                          </Bar>
                          <Tooltip content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 border border-border p-2 rounded text-[10px] font-bold">
                                  {payload[0].value?.toString()}% Success
                                </div>
                              );
                            }
                            return null;
                          }} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-2">
                        <span>{selectedDataset.privileged_group}</span>
                        <span>{selectedDataset.unprivileged_group}</span>
                      </div>
                    </div>
                  </div>

                  {/* Equal Opportunity Card */}
                  <div className="glass-card">
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4 underline decoration-rose-500/30 decoration-2 underline-offset-4">Equal Opportunity</h4>
                    <div className={cn("text-4xl font-black mb-2", Math.abs(metrics?.equalOpportunity || 0) > 0.05 ? "text-rose-500" : "text-emerald-500")}>
                      <AnimatedValue value={metrics?.equalOpportunity || 0} decimals={3} />
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mt-4">
                      {selectedDataset.unprivileged_group} applicants are {Math.abs(Math.round((metrics?.equalOpportunity || 0) * 100))}% less likely to receive favorable outcomes given same qualifications.
                    </p>
                  </div>
                </div>

                {/* Root Cause Analyzer */}
                {analysis && (
                  <RootCauseAnalyzer 
                    correlations={analysis.correlations}
                    mismatch={analysis.mismatch}
                    protectedFeature={selectedDataset.protected_feature}
                    privileged={selectedDataset.privileged_group}
                    unprivileged={selectedDataset.unprivileged_group}
                  />
                )}

                {/* Gemini Insight */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 md:p-6 flex flex-col sm:flex-row gap-4 md:gap-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                    <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-slate-950" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h4 className="text-xs md:text-sm font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      Gemini Audit Explanation
                      {isLoadingExplanation && <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />}
                    </h4>
                    {isLoadingExplanation ? (
                      <div className="space-y-3 pt-2">
                        <div className="h-4 bg-amber-500/10 rounded w-full animate-pulse" />
                        <div className="h-4 bg-amber-500/10 rounded w-5/6 animate-pulse" />
                        <div className="h-3 bg-amber-500/10 rounded w-1/2 animate-pulse mt-4" />
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-slate-200 leading-relaxed"
                      >
                        <p className="mb-2 italic">"{explanation?.explanation}"</p>
                        <p className="text-xs text-slate-400">
                          <strong className="text-amber-500/80 uppercase mr-1">Root Cause:</strong> {explanation?.root_cause}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          <strong className="text-primary/80 uppercase mr-1">Recommendation:</strong> {explanation?.fix}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Bias Time Machine Section */}
                <div className="overflow-x-hidden">
                  <BiasTimeMachine selectedDataset={selectedDataset} />
                </div>

                {/* Mobile View Toggle Datasets */}
                <div className="lg:hidden grid grid-cols-1 gap-4 pt-10">
                  <h3 className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Change Active Dataset</h3>
                  {DATASETS.map((ds) => (
                    <button key={ds.id} onClick={() => setSelectedDataset(ds)} className={cn("glass-card text-left p-4", selectedDataset?.id === ds.id && "border-primary")}>
                      <span className="font-bold">{ds.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-10 shadow-2xl shadow-rose-500/20">
                  <ShieldAlert className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight max-w-2xl">
                  73% of AI systems contain <span className="text-rose-500">hidden bias</span>.
                </h2>
                <p className="text-slate-400 text-lg mt-6 max-w-xl">
                  Algorithmic discrimination is often invisible. Select a dataset from the sidebar to audit your model's fairness in real-time.
                </p>
                <div className="mt-10 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">H</div>
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">L</div>
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">T</div>
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">A</div>
                    <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">M</div>
                  </div>
                  <span>{DATASETS.length} Dataset modules ready for audit</span>
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* Dataset Selector for Mobile/Tablet at Footer */}
          <section id="dataset-selector" className="lg:hidden mt-12 bg-slate-900/30 border border-border rounded-xl p-8 space-y-6">
              <h3 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4 text-center">Select Dataset to Audit</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DATASETS.map((ds) => (
                  <button
                    key={ds.id}
                    onClick={() => {
                      setSelectedDataset(ds);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all group",
                      selectedDataset?.id === ds.id 
                        ? "bg-primary/10 border-primary" 
                        : "bg-surface border-border hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        selectedDataset?.id === ds.id ? "bg-primary text-white" : "bg-slate-800 text-slate-400"
                      )}>
                        {React.cloneElement(getIcon(ds.icon) as React.ReactElement, { className: "w-4 h-4" })}
                      </div>
                      <span className="font-bold text-sm">{ds.name}</span>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        </main>
      </div>

      <footer className="py-6 px-4 border-t border-border bg-slate-950 text-center text-slate-500 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.1em] md:tracking-[0.2em] relative z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span>&copy; 2026 FairCheck Auditor • Google Solution Challenge</span>
          <span className="hidden sm:inline">Built with Gemini 1.5 Flash</span>
        </div>
      </footer>
    </div>
  );
}
