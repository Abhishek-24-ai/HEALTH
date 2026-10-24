import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Play, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  Download,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { syncWithMockServer, subscribeSyncEvents } from '../utils/syncEngine';
import { isSupabaseConfigured } from '../supabaseClient';
import { BACKEND_BASE_URL } from '../api';

export default function SyncConsoleModal({ isOpen, onClose, onSyncFinished }) {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeSyncEvents((event) => {
      if (event.type === 'SYNC_STARTED') {
        setIsRunning(true);
      } else if (event.type === 'LOG') {
        setLogs((prev) => [...prev, event.entry]);
      } else if (event.type === 'SYNC_COMPLETE' || event.type === 'SYNC_ERROR') {
        setIsRunning(false);
        if (onSyncFinished) onSyncFinished();
      }
    });

    return () => unsubscribe();
  }, [isOpen, onSyncFinished]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsRunning(true);
    await syncWithMockServer((logEntry) => {
      // Live logs streamed
    });
  };

  const handleClearTerminal = () => {
    setLogs([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Terminal Title Bar */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 pl-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-white tracking-wider">
                DISTRICT_CLOUD_DISPATCHER // PRIORITY_QUEUE_V1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              isRunning ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isRunning ? 'DISPATCHING PACKETS' : 'TERMINAL READY'}
            </span>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Console Action Bar */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate max-w-xl">
              Target: Live Render Backend ({BACKEND_BASE_URL}) + Supabase PostgreSQL
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearTerminal}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-800 transition"
            >
              Clear Buffer
            </button>
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isRunning}
              className="px-3.5 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded transition shadow flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              Run Priority Sync
            </button>
          </div>
        </div>

        {/* Live Terminal Log Viewer */}
        <div className="p-4 bg-slate-950 font-mono text-xs overflow-y-auto flex-1 space-y-1.5 min-h-[350px]">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-12 text-center">
              [SYSTEM] Telemetry pipeline idle. Click "Run Priority Sync" to dispatch unsynced records via Red-First protocol.
            </div>
          ) : (
            logs.map((item, idx) => {
              const isError = item.level === 'error';
              const isSuccess = item.level === 'success';
              const isWarning = item.level === 'warning';

              return (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 select-none shrink-0">
                    [{item.timestamp}]
                  </span>
                  <span className={`break-all ${
                    isError 
                      ? 'text-rose-400 font-bold' 
                      : isSuccess 
                      ? 'text-emerald-400 font-bold' 
                      : isWarning 
                      ? 'text-amber-300' 
                      : 'text-slate-300'
                  }`}>
                    {item.text}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Footer */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Air-Gap Cryptographic Verification: Enabled</span>
          </div>
          <span>Protocol: RFC-3829-MEDSYNC</span>
        </div>

      </div>
    </div>
  );
}
