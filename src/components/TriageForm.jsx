import React, { useState, useMemo } from 'react';
import { 
  calculateMEWS, 
  PRESET_SCENARIOS, 
  AVPU_OPTIONS 
} from '../utils/mews';
import { addPatientRecord } from '../db';
import { 
  playRedAlertSound, 
  playYellowAlertSound, 
  playGreenAlertSound, 
  playKeypadBeep 
} from '../utils/audioAlert';
import AirGapModal from './AirGapModal';
import { 
  Activity, 
  Heart, 
  Flame, 
  Wind, 
  AlertCircle, 
  Sparkles, 
  Save, 
  RotateCcw, 
  QrCode, 
  User, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Stethoscope,
  Droplet,
  ChevronRight,
  Zap
} from 'lucide-react';

const INITIAL_VITALS = {
  systolicBP: 120,
  diastolicBP: 80,
  heartRate: 75,
  respRate: 16,
  temperature: 36.8,
  avpu: 'A',
  spo2: 98,
  bloodGlucose: 105,
};

const INITIAL_DEMO = {
  name: '',
  age: '',
  sex: 'Female',
  chiefComplaint: '',
  allergies: 'NKDA',
  medicalHistory: '',
  originUnit: 'Field Unit Alpha',
};

const COMMON_CHIEF_COMPLAINTS = [
  'Septic Shock / Rigors',
  'Severe Respiratory Distress',
  'Blunt Polytrauma',
  'Chest Pain / Acute Coronary',
  'Pediatric High Pyrexia',
  'Altered Mental Status',
  'Dehydration / Heat Stroke',
];

export default function TriageForm({ onPatientCreated, onShowToast }) {
  const [demographics, setDemographics] = useState(INITIAL_DEMO);
  const [vitals, setVitals] = useState(INITIAL_VITALS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPatient, setSavedPatient] = useState(null);
  const [showAirGapModal, setShowAirGapModal] = useState(false);
  const [activePresetId, setActivePresetId] = useState(null);

  // Real-time zero-latency MEWS calculation
  const mews = useMemo(() => {
    return calculateMEWS(vitals);
  }, [vitals]);

  const handleVitalChange = (field, value) => {
    setVitals((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAdjustVital = (field, delta) => {
    playKeypadBeep();
    setVitals((prev) => {
      const current = Number(prev[field]) || 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [field]: field === 'temperature' ? Number(next.toFixed(1)) : Math.round(next),
      };
    });
  };

  const loadPreset = (preset) => {
    playKeypadBeep();
    setActivePresetId(preset.id);
    setDemographics({
      ...preset.demographics,
      originUnit: 'Field Unit Alpha',
    });
    setVitals({ ...preset.vitals });

    if (preset.level === 'RED') {
      playRedAlertSound();
    } else if (preset.level === 'YELLOW') {
      playYellowAlertSound();
    } else {
      playGreenAlertSound();
    }

    if (onShowToast) {
      onShowToast(`Loaded ${preset.name} (${preset.tag})`);
    }
  };

  const handleReset = () => {
    playKeypadBeep();
    setDemographics(INITIAL_DEMO);
    setVitals(INITIAL_VITALS);
    setActivePresetId(null);
  };

  const handleSaveAndGenerateQR = async (e) => {
    e?.preventDefault();
    setIsSaving(true);

    try {
      const finalPatient = {
        name: demographics.name.trim() || 'Anonymous Patient',
        age: Number(demographics.age) || 0,
        sex: demographics.sex,
        chiefComplaint: demographics.chiefComplaint.trim() || 'Acute triage assessment',
        allergies: demographics.allergies || 'NKDA',
        medicalHistory: demographics.medicalHistory || '',
        originUnit: demographics.originUnit || 'Field Unit Alpha',
        vitals,
        mews,
        timestamp: Date.now(),
      };

      const record = await addPatientRecord(finalPatient);
      setSavedPatient(record);
      setShowAirGapModal(true);

      // Play audio feedback
      if (mews.level === 'RED') {
        playRedAlertSound();
      } else if (mews.level === 'YELLOW') {
        playYellowAlertSound();
      } else {
        playGreenAlertSound();
      }

      if (onPatientCreated) {
        onPatientCreated(record);
      }

      if (onShowToast) {
        onShowToast(`Patient ${record.name} saved! Optical QR Generated.`);
      }
    } catch (err) {
      console.error('Error saving patient:', err);
      alert('Error saving record: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const isRed = mews.level === 'RED';
  const isYellow = mews.level === 'YELLOW';
  const isGreen = mews.level === 'GREEN';

  // SVG Gauge calculations
  const strokeDashoffset = 283 - (283 * Math.min(mews.score, 14)) / 14;

  return (
    <div className="space-y-6">
      
      {/* 30-Second Stage Demo Preset Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 backdrop-blur-md shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              1-Click Demo Scenarios (Rapid Pitch Mode)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Instantaneous Telemetry & MEWS Score Injection
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SCENARIOS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            const pRed = preset.level === 'RED';
            const pYellow = preset.level === 'YELLOW';

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(preset)}
                className={`text-left p-2.5 rounded-lg border transition-all relative overflow-hidden group ${
                  isSelected
                    ? pRed
                      ? 'bg-rose-950/60 border-rose-500/80 shadow-md shadow-rose-950/50'
                      : pYellow
                      ? 'bg-amber-950/60 border-amber-500/80 shadow-md shadow-amber-950/50'
                      : 'bg-emerald-950/60 border-emerald-500/80 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    pRed
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : pYellow
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {preset.tag}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="mt-1.5 font-semibold text-xs text-white truncate">
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Dual-Column Clinical Intake Interface */}
      <form onSubmit={handleSaveAndGenerateQR} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Demographics & Physiological Telemetry (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Patient Demographics Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  01. Patient Identification & Anamnesis
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Field Intake Protocol
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-6">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  PATIENT FULL NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Elena Rostova"
                  value={demographics.name}
                  onChange={(e) => setDemographics({ ...demographics, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  AGE (YEARS)
                </label>
                <input
                  type="number"
                  placeholder="48"
                  value={demographics.age}
                  onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  BIOLOGICAL SEX
                </label>
                <select
                  value={demographics.sex}
                  onChange={(e) => setDemographics({ ...demographics, sex: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition font-mono"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-12">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  CHIEF CLINICAL COMPLAINT / TRAUMA MECHANISM
                </label>
                <input
                  type="text"
                  placeholder="e.g. Altered mental status, severe hypotension, high fever"
                  value={demographics.chiefComplaint}
                  onChange={(e) => setDemographics({ ...demographics, chiefComplaint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
                
                {/* Quick complaint chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_CHIEF_COMPLAINTS.map((complaint) => (
                    <button
                      key={complaint}
                      type="button"
                      onClick={() => setDemographics({ ...demographics, chiefComplaint: complaint })}
                      className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-800 transition"
                    >
                      + {complaint}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  KNOWN ALLERGIES
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa, NKDA"
                  value={demographics.allergies}
                  onChange={(e) => setDemographics({ ...demographics, allergies: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  ORIGIN UNIT / SECTOR
                </label>
                <input
                  type="text"
                  placeholder="e.g. Field Post Alpha, Mobile Squad 2"
                  value={demographics.originUnit}
                  onChange={(e) => setDemographics({ ...demographics, originUnit: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* Core Physiological Telemetry Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  02. Real-Time Vitals Telemetry
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Deterministic Scoring Active
              </span>
            </div>

            <div className="space-y-4">
              
              {/* 1. Blood Pressure */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className="text-xs font-bold text-white font-mono">BLOOD PRESSURE</span>
                      <span className="text-[11px] text-slate-400 font-mono ml-2">Systolic / Diastolic (mmHg)</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    mews.breakdown.systolicBP.points > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    MEWS: +{mews.breakdown.systolicBP.points} pts ({mews.breakdown.systolicBP.desc})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-slate-400">Systolic (MEWS Scored)</span>
                      <span className="text-sm font-bold font-mono text-white">{vitals.systolicBP} mmHg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAdjustVital('systolicBP', -5)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                      >
                        -5
                      </button>
                      <input
                        type="range"
                        min="50"
                        max="240"
                        step="1"
                        value={vitals.systolicBP}
                        onChange={(e) => handleVitalChange('systolicBP', Number(e.target.value))}
                        className="w-full accent-rose-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustVital('systolicBP', 5)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-slate-400">Diastolic</span>
                      <span className="text-sm font-bold font-mono text-white">{vitals.diastolicBP} mmHg</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAdjustVital('diastolicBP', -5)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                      >
                        -5
                      </button>
                      <input
                        type="range"
                        min="30"
                        max="140"
                        step="1"
                        value={vitals.diastolicBP}
                        onChange={(e) => handleVitalChange('diastolicBP', Number(e.target.value))}
                        className="w-full accent-slate-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustVital('diastolicBP', 5)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Heart Rate & Resp Rate Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Heart Rate */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold text-white font-mono">HEART RATE</span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      mews.breakdown.heartRate.points > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      +{mews.breakdown.heartRate.points} pts
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-slate-400">Target: 51-100 bpm</span>
                    <span className="text-base font-extrabold font-mono text-white">{vitals.heartRate} <span className="text-xs font-normal text-slate-400">bpm</span></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('heartRate', -5)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      -5
                    </button>
                    <input
                      type="range"
                      min="30"
                      max="190"
                      step="1"
                      value={vitals.heartRate}
                      onChange={(e) => handleVitalChange('heartRate', Number(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('heartRate', 5)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      +5
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                    {mews.breakdown.heartRate.desc}
                  </p>
                </div>

                {/* Respiratory Rate */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white font-mono">RESP RATE</span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      mews.breakdown.respRate.points > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      +{mews.breakdown.respRate.points} pts
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-slate-400">Target: 9-14 /min</span>
                    <span className="text-base font-extrabold font-mono text-white">{vitals.respRate} <span className="text-xs font-normal text-slate-400">/min</span></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('respRate', -2)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      -2
                    </button>
                    <input
                      type="range"
                      min="4"
                      max="48"
                      step="1"
                      value={vitals.respRate}
                      onChange={(e) => handleVitalChange('respRate', Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('respRate', 2)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      +2
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                    {mews.breakdown.respRate.desc}
                  </p>
                </div>

              </div>

              {/* 3. Temperature & AVPU Scale Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Temperature */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-white font-mono">TEMPERATURE</span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      mews.breakdown.temperature.points > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      +{mews.breakdown.temperature.points} pts
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono text-slate-400">Target: 35.0-38.4°C</span>
                    <span className="text-base font-extrabold font-mono text-white">{vitals.temperature} <span className="text-xs font-normal text-slate-400">°C</span></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('temperature', -0.5)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      -0.5
                    </button>
                    <input
                      type="range"
                      min="30.0"
                      max="42.5"
                      step="0.1"
                      value={vitals.temperature}
                      onChange={(e) => handleVitalChange('temperature', Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('temperature', 0.5)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded border border-slate-800"
                    >
                      +0.5
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5 truncate">
                    {mews.breakdown.temperature.desc}
                  </p>
                </div>

                {/* AVPU Scale */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white font-mono">AVPU CONSCIOUSNESS</span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      mews.breakdown.avpu.points > 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      +{mews.breakdown.avpu.points} pts
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {AVPU_OPTIONS.map((opt) => {
                      const isSelected = vitals.avpu === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            playKeypadBeep();
                            handleVitalChange('avpu', opt.value);
                          }}
                          className={`p-2 rounded text-center transition border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-400 shadow-md font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 text-xs'
                          }`}
                          title={opt.label}
                        >
                          <span className="text-sm font-mono block font-bold">{opt.value}</span>
                          <span className="text-[9px] block text-slate-300 truncate">
                            +{opt.points} pts
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-2 truncate">
                    {mews.breakdown.avpu.desc}
                  </p>
                </div>

              </div>

              {/* 4. Secondary Telemetry: SpO2 and Blood Glucose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">PULSE OXIMETRY (SpO2)</span>
                    <span className={`text-base font-bold font-mono ${
                      vitals.spo2 < 92 ? 'text-rose-400' : vitals.spo2 < 95 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {vitals.spo2}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('spo2', -2)}
                      className="px-2 py-0.5 bg-slate-900 text-slate-300 text-xs rounded border border-slate-800"
                    >
                      -2%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('spo2', 2)}
                      className="px-2 py-0.5 bg-slate-900 text-slate-300 text-xs rounded border border-slate-800"
                    >
                      +2%
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">BLOOD GLUCOSE</span>
                    <span className={`text-base font-bold font-mono ${
                      vitals.bloodGlucose < 70 || vitals.bloodGlucose > 200 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {vitals.bloodGlucose} mg/dL
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('bloodGlucose', -10)}
                      className="px-2 py-0.5 bg-slate-900 text-slate-300 text-xs rounded border border-slate-800"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustVital('bloodGlucose', 10)}
                      className="px-2 py-0.5 bg-slate-900 text-slate-300 text-xs rounded border border-slate-800"
                    >
                      +10
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Live MEWS Gauge & Tactical Clinical Decision Support (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className={`bg-slate-900/90 border rounded-2xl p-5 shadow-2xl backdrop-blur-md transition-all relative overflow-hidden ${
            isRed 
              ? 'border-rose-500/60 triage-glow-red shadow-rose-950/30' 
              : isYellow 
              ? 'border-amber-500/50 triage-glow-yellow shadow-amber-950/20' 
              : 'border-emerald-500/40 triage-glow-green shadow-emerald-950/20'
          }`}>
            
            {/* Header Telemetry Status */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isRed ? 'bg-rose-500 animate-ping' : isYellow ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  MEWS Clinical Telemetry
                </span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${mews.styleClasses.badge}`}>
                LEVEL {mews.level}
              </span>
            </div>

            {/* Circular Gauge / Score Matrix */}
            <div className="py-6 flex flex-col items-center justify-center relative">
              <div className="relative w-44 h-44 flex items-center justify-center">
                
                {/* SVG Radial Meter */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    className="stroke-slate-800"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  <circle
                    cx="88"
                    cy="88"
                    r="72"
                    className={`${mews.styleClasses.ring} transition-all duration-300 ease-out`}
                    strokeWidth="12"
                    strokeDasharray="452"
                    strokeDashoffset={452 - (452 * Math.min(mews.score, 14)) / 14}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Center score readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                    MEWS INDEX
                  </span>
                  <div className={`text-5xl font-black font-mono tracking-tight ${
                    isRed ? 'text-rose-400 animate-pulse' : isYellow ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {mews.score}
                  </div>
                  <span className="text-xs font-mono text-slate-500 mt-0.5">
                    SCALE: 0 - 14+
                  </span>
                </div>
              </div>

              {/* Urgency Classification Banner */}
              <div className={`mt-4 w-full p-2.5 rounded-lg border text-center ${
                isRed 
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' 
                  : isYellow 
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}>
                <div className="text-xs font-black tracking-wide font-mono">
                  {mews.urgencyLabel}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Target Clinical Contact: <span className="text-white font-bold">{mews.responseTime}</span>
                </div>
              </div>
            </div>

            {/* MEWS Score Breakdown Grid */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-[11px] font-mono uppercase text-slate-400 block font-bold">
                PHYSIOLOGICAL RISK CONTRIBUTION
              </span>
              
              <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-mono">
                <div className={`p-1.5 rounded border ${
                  mews.breakdown.systolicBP.points > 0 ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[9px] block text-slate-500">BP</span>
                  <span className="font-bold">+{mews.breakdown.systolicBP.points}</span>
                </div>

                <div className={`p-1.5 rounded border ${
                  mews.breakdown.heartRate.points > 0 ? 'bg-rose-950/40 border-rose-500/30 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[9px] block text-slate-500">HR</span>
                  <span className="font-bold">+{mews.breakdown.heartRate.points}</span>
                </div>

                <div className={`p-1.5 rounded border ${
                  mews.breakdown.respRate.points > 0 ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[9px] block text-slate-500">RR</span>
                  <span className="font-bold">+{mews.breakdown.respRate.points}</span>
                </div>

                <div className={`p-1.5 rounded border ${
                  mews.breakdown.temperature.points > 0 ? 'bg-amber-950/40 border-amber-500/30 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[9px] block text-slate-500">TEMP</span>
                  <span className="font-bold">+{mews.breakdown.temperature.points}</span>
                </div>

                <div className={`p-1.5 rounded border ${
                  mews.breakdown.avpu.points > 0 ? 'bg-purple-950/40 border-purple-500/30 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="text-[9px] block text-slate-500">AVPU</span>
                  <span className="font-bold">+{mews.breakdown.avpu.points}</span>
                </div>
              </div>
            </div>

            {/* Protocol Action Directive */}
            <div className="mt-4 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
                <AlertCircle className="w-4 h-4" />
                MANDATORY CLINICAL DIRECTIVE
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                {mews.clinicalAction}
              </p>
            </div>

            {/* Primary Action Button: Save & Generate Air-Gap QR */}
            <div className="mt-5 space-y-2.5">
              <button
                type="submit"
                disabled={isSaving}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition shadow-xl flex items-center justify-center gap-2.5 cursor-pointer ${
                  isRed
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60 animate-pulse'
                    : isYellow
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/60'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span>SAVE & GENERATE AIR-GAP QR</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded-lg transition border border-slate-800 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Intake Form</span>
              </button>
            </div>

          </div>

        </div>

      </form>

      {/* Optical Air-Gap Token Generation Modal */}
      {showAirGapModal && savedPatient && (
        <AirGapModal
          patient={savedPatient}
          onClose={() => setShowAirGapModal(false)}
          onTransferSuccess={(msg) => onShowToast && onShowToast(msg)}
        />
      )}

    </div>
  );
}
