import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllPatients, 
  seedDemoPatientsIfEmpty, 
  getUnsyncedPatients 
} from './db';
import { 
  syncWithMockServer 
} from './utils/syncEngine';
import { 
  setAudioMuted, 
  isAudioMuted, 
  playKeypadBeep 
} from './utils/audioAlert';
import TriageForm from './components/TriageForm';
import QRScanner from './components/QRScanner';
import HospitalDashboard from './components/HospitalDashboard';
import { 
  Activity, 
  Scan, 
  LayoutDashboard, 
  Wifi, 
  WifiOff, 
  Volume2, 
  VolumeX, 
  Clock, 
  ShieldCheck, 
  Radio, 
  CheckCircle2, 
  Terminal, 
  FileSpreadsheet,
  AlertOctagon,
  Download
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('INTAKE'); // 'INTAKE' | 'SCANNER' | 'QUEUE'
  const [patients, setPatients] = useState([]);
  const [isAirGapMode, setIsAirGapMode] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toastMessage, setToastMessage] = useState(null);
  const [muted, setMuted] = useState(isAudioMuted());
  const [isSyncing, setIsSyncing] = useState(false);

  // Load patients and seed demo records if first time
  const refreshPatients = useCallback(async () => {
    try {
      await seedDemoPatientsIfEmpty();
      const records = await getAllPatients();
      setPatients(records);
    } catch (err) {
      console.error('Failed to load patient records:', err);
    }
  }, []);

  useEffect(() => {
    refreshPatients();
  }, [refreshPatients]);

  // Live mission clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => {
      showToast('Network detected: District link candidate available.');
    };
    const handleOffline = () => {
      showToast('Offline signal loss: Pure air-gap protocol enforced.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3800);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  // Connectivity Simulation Switch: Air-Gap Mode <---> District Cloud
  const handleToggleAirGap = async () => {
    playKeypadBeep();
    const nextMode = !isAirGapMode;
    setIsAirGapMode(nextMode);

    if (!nextMode) {
      // Switched to District Cloud (Online) -> Prompt priority sync
      showToast('DISTRICT CLOUD LINK ESTABLISHED. Auto-triggering Red-First queue sync...');
      setIsSyncing(true);
      try {
        const res = await syncWithMockServer();
        if (res.success || res.status === 'SUCCESS') {
          const count = res.syncedCount ?? res.count ?? 0;
          showToast(`District Cloud Sync Complete: ${count} emergency records replicated.`);
          await refreshPatients();
        } else if (res.status === 'OFFLINE') {
          showToast('Device is offline. Air-gap records retained in IndexedDB.');
        }
      } catch (err) {
        showToast('Sync notice: ' + err.message);
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast('AIR-GAP MODE ACTIVATED: Radios disconnected. Optical handoff active.');
    }
  };

  const criticalRedCount = patients.filter((p) => p.level === 'RED').length;
  const unsyncedCount = patients.filter((p) => p.synced === 0).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-telemetry-grid relative selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Top Sticky Clinical Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* System Branding & Live Telemetry Pulse */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-rose-600 p-0.5 shadow-md shadow-cyan-950">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-tight text-white font-mono">
                    AURA-TRIAGE
                  </h1>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    v2.4-MED
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 hidden sm:flex items-center gap-2">
                  <span>AIR-GAPPED CLINICAL PROTOCOL</span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    MEWS CLINICAL ENGINE ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Mission Live Clock */}
            <div className="hidden md:flex items-center gap-3 bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400">MISSION UTC:</span>
                <span className="text-white font-bold font-mono-nums">
                  {currentTime.toUTCString().slice(17, 25)}
                </span>
              </div>
            </div>

            {/* Right: Connectivity Switch + Audio FX Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Interactive Connectivity Simulation Switch */}
              <button
                type="button"
                onClick={handleToggleAirGap}
                title="Toggle between Air-Gap Mode and District Cloud Sync"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                  isAirGapMode
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                {isAirGapMode ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Air-Gap Mode (Offline)</span>
                    <span className="sm:hidden">Air-Gap</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">District Cloud (Online)</span>
                    <span className="sm:hidden">Cloud</span>
                  </>
                )}
                <span className={`w-2 h-2 rounded-full ${isAirGapMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              </button>

              {/* Audio Mute/Unmute */}
              <button
                type="button"
                onClick={handleToggleMute}
                title={muted ? 'Unmute Emergency Alarm FX' : 'Mute Emergency Audio'}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>

            </div>

          </div>
        </div>

        {/* Tactical Tab Navigation Bar */}
        <div className="bg-slate-950/95 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 py-2 overflow-x-auto">
            
            {/* Tab 1: Intake Form */}
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('INTAKE'); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'INTAKE'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Triage Intake</span>
            </button>

            {/* Tab 2: Optical Air-Gap Scanner */}
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('SCANNER'); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'SCANNER'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Scan className="w-4 h-4" />
              <span>Air-Gap Optical Scanner</span>
            </button>

            {/* Tab 3: Hospital Emergency Queue */}
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('QUEUE'); }}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'QUEUE'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Hospital Emergency Queue</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                criticalRedCount > 0 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {patients.length}
              </span>
            </button>

            {/* Critical Red Warning Chip if any */}
            {criticalRedCount > 0 && (
              <div className="ml-auto hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono animate-pulse">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>{criticalRedCount} CODE RED IN QUEUE</span>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Main Clinical Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'INTAKE' && (
          <TriageForm
            onPatientCreated={(newRecord) => {
              refreshPatients();
              showToast(`Patient ${newRecord.name} registered. Optical token generated.`);
            }}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'SCANNER' && (
          <QRScanner
            onPatientAdmitted={(admittedRecord) => {
              refreshPatients();
              showToast(`Optical Handshake: ${admittedRecord.name} admitted to emergency queue.`);
            }}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'QUEUE' && (
          <HospitalDashboard
            patients={patients}
            onRefresh={refreshPatients}
            onShowToast={showToast}
            isAirGapMode={isAirGapMode}
            onToggleAirGap={handleToggleAirGap}
          />
        )}
      </main>

      {/* Floating Tactical Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 border border-cyan-500/40 rounded-xl shadow-2xl text-xs font-mono text-cyan-200 animate-in slide-in-from-bottom duration-200 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bottom Mission Status Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-3 px-4 sm:px-6 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>AURA-TRIAGE Offline Clinical Runtime // RFC-3829 Compliance</span>
        </div>
        <div>
          Zero-Connectivity Emergency Protocol • Air-Gapped Optical Patient Transfers
        </div>
      </footer>

    </div>
  );
}
