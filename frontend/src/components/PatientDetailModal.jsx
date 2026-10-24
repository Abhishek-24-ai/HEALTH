import React, { useState } from 'react';
import { 
  X, 
  Activity, 
  Heart, 
  Wind, 
  Flame, 
  Droplet, 
  ShieldAlert, 
  Clock, 
  Calendar, 
  QrCode, 
  CheckCircle2, 
  CloudOff, 
  Cloud, 
  Trash2, 
  Printer, 
  AlertTriangle,
  Send
} from 'lucide-react';
import { calculateMEWS } from '../utils/mews';
import { markPatientAsSynced, deletePatientRecord } from '../db';
import AirGapModal from './AirGapModal';

export default function PatientDetailModal({ patient, onClose, onUpdated, onDeleted, onShowToast }) {
  const [showQR, setShowQR] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!patient) return null;

  const mews = patient.mews || calculateMEWS(patient.vitals);
  const isRed = patient.level === 'RED' || mews.level === 'RED';
  const isYellow = patient.level === 'YELLOW' || mews.level === 'YELLOW';

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const ackId = `ACK-MANUAL-${Date.now().toString(36).toUpperCase()}`;
      await markPatientAsSynced(patient.id, ackId);
      if (onUpdated) onUpdated();
      if (onShowToast) onShowToast(`Patient ${patient.name} manually synced to Cloud.`);
    } catch (e) {
      alert('Sync failed: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete patient record for ${patient.name}?`)) {
      await deletePatientRecord(patient.id);
      if (onDeleted) onDeleted(patient.id);
      if (onShowToast) onShowToast(`Patient ${patient.name} record removed.`);
      onClose();
    }
  };

  const formattedTime = new Date(patient.timestamp).toLocaleString();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className={`relative w-full max-w-3xl bg-slate-900 border rounded-2xl shadow-2xl overflow-hidden my-auto ${
          isRed ? 'border-rose-500/50' : isYellow ? 'border-amber-500/40' : 'border-emerald-500/40'
        }`}>
          
          {/* Header Bar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/70">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-full border ${
                isRed
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : isYellow
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                CODE {patient.level}
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  {patient.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {patient.triageId} • UUID: {patient.patientUuid}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQR(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono rounded-lg transition border border-slate-700 flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                Air-Gap QR
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            
            {/* Top Stat Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block">MEWS SCORE</span>
                <span className={`text-2xl font-black font-mono ${
                  isRed ? 'text-rose-400' : isYellow ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {mews.score} <span className="text-xs font-normal text-slate-500">/ 14</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                  {mews.urgencyLabel}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block">DEMOGRAPHICS</span>
                <span className="text-sm font-bold text-slate-200 block font-mono">
                  {patient.age}y / {patient.sex}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5 truncate">
                  Allergies: {patient.allergies || 'NKDA'}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block">DISTRICT SYNC</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {patient.synced ? (
                    <>
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-emerald-300">Synchronized</span>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-mono font-bold text-amber-300">Air-Gapped Only</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                  {patient.serverAckId ? patient.serverAckId.substring(0, 16) : 'Unsynced'}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 block">INTAKE TIME</span>
                <span className="text-xs font-mono text-slate-300 block font-bold mt-1">
                  {formattedTime}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">
                  Unit: {patient.originUnit || 'Field Unit Alpha'}
                </span>
              </div>
            </div>

            {/* Complete Physiological Telemetry */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Full Physiological Telemetry Record
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Real-time Parameters
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">BLOOD PRESSURE</span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {patient.vitals?.systolicBP}/{patient.vitals?.diastolicBP || '–'}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    +{mews.breakdown.systolicBP.points} pts
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">HEART RATE</span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {patient.vitals?.heartRate} <span className="text-xs font-normal text-slate-400">bpm</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    +{mews.breakdown.heartRate.points} pts
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">RESP RATE</span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {patient.vitals?.respRate} <span className="text-xs font-normal text-slate-400">/min</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    +{mews.breakdown.respRate.points} pts
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">TEMPERATURE</span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {patient.vitals?.temperature}°C
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    +{mews.breakdown.temperature.points} pts
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">AVPU SCALE</span>
                  <span className="text-base font-bold text-purple-400 block mt-0.5">
                    {patient.vitals?.avpu}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    +{mews.breakdown.avpu.points} pts
                  </span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">SpO2 PULSE OX</span>
                  <span className="text-base font-bold text-cyan-400 block mt-0.5">
                    {patient.vitals?.spo2 || 98}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Oxygen Sat</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">GLUCOSE</span>
                  <span className="text-base font-bold text-white block mt-0.5">
                    {patient.vitals?.bloodGlucose || '–'} <span className="text-xs text-slate-400">mg/dL</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Glycemic</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">OPTICAL TRANSFERS</span>
                  <span className="text-base font-bold text-emerald-400 block mt-0.5">
                    {patient.opticalTransfers || 1}x
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Air-gap logs</span>
                </div>
              </div>
            </div>

            {/* Clinical Anamnesis / Chief Complaint */}
            <div className="space-y-3">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-mono font-bold text-slate-400 block uppercase">
                  CHIEF COMPLAINT / TRAUMA REPORT
                </span>
                <p className="text-sm text-slate-200 mt-1">
                  {patient.chiefComplaint || 'No chief complaint recorded'}
                </p>
                {patient.medicalHistory && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-mono text-slate-500 block uppercase">
                      PAST MEDICAL HISTORY
                    </span>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {patient.medicalHistory}
                    </p>
                  </div>
                )}
              </div>

              {/* Protocol Directive */}
              <div className={`p-4 rounded-xl border ${
                isRed
                  ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                  : isYellow
                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              }`}>
                <div className="flex items-center gap-2 text-xs font-mono font-bold mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  EMERGENCY PROTOCOL ACTION DIRECTIVE
                </div>
                <p className="text-xs leading-relaxed">
                  {mews.clinicalAction}
                </p>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-500 space-y-1">
              <div>Record Created: {new Date(patient.timestamp).toISOString()}</div>
              <div>Ingestion Protocol: {patient.admittedVia || 'Direct Intake Form'}</div>
              <div>Server Replicated: {patient.synced ? `Yes (${patient.syncedAt ? new Date(patient.syncedAt).toLocaleTimeString() : 'Verified'})` : 'No (Pending Air-Gap sync)'}</div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-mono rounded-lg transition border border-rose-800 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Record
            </button>

            <div className="flex items-center gap-2">
              {!patient.synced && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-md flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSyncing ? 'Syncing...' : 'Sync to District Cloud'}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition border border-slate-700"
              >
                Close Drawer
              </button>
            </div>
          </div>

        </div>
      </div>

      {showQR && (
        <AirGapModal
          patient={patient}
          onClose={() => setShowQR(false)}
          onTransferSuccess={(msg) => onShowToast && onShowToast(msg)}
        />
      )}
    </>
  );
}
