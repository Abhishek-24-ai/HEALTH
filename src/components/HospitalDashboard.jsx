import React, { useState, useMemo } from 'react';
import { 
  Users, 
  AlertTriangle, 
  CloudOff, 
  Activity, 
  Search, 
  Filter, 
  QrCode, 
  Eye, 
  Cloud, 
  RotateCcw, 
  Send, 
  ChevronRight, 
  Sparkles,
  ArrowUpDown,
  Stethoscope,
  Terminal,
  Clock,
  ShieldAlert
} from 'lucide-react';
import PatientDetailModal from './PatientDetailModal';
import AirGapModal from './AirGapModal';
import SyncConsoleModal from './SyncConsoleModal';
import { resetDatabase } from '../db';
import { playKeypadBeep } from '../utils/audioAlert';

export default function HospitalDashboard({ 
  patients = [], 
  onRefresh, 
  onShowToast, 
  isAirGapMode, 
  onToggleAirGap 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'UNSYNCED'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [qrModalPatient, setQrModalPatient] = useState(null);
  const [showSyncConsole, setShowSyncConsole] = useState(false);

  // Filter patients by tab and search
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Tab filter
      if (activeTab === 'RED' && patient.level !== 'RED') return false;
      if (activeTab === 'YELLOW' && patient.level !== 'YELLOW') return false;
      if (activeTab === 'GREEN' && patient.level !== 'GREEN') return false;
      if (activeTab === 'UNSYNCED' && patient.synced === 1) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (patient.name || '').toLowerCase().includes(query);
        const uuidMatch = (patient.patientUuid || '').toLowerCase().includes(query);
        const triageMatch = (patient.triageId || '').toLowerCase().includes(query);
        const complaintMatch = (patient.chiefComplaint || '').toLowerCase().includes(query);
        return nameMatch || uuidMatch || triageMatch || complaintMatch;
      }

      return true;
    });
  }, [patients, activeTab, searchQuery]);

  // Aggregate KPI metrics
  const totalCount = patients.length;
  const redCount = patients.filter((p) => p.level === 'RED').length;
  const yellowCount = patients.filter((p) => p.level === 'YELLOW').length;
  const greenCount = patients.filter((p) => p.level === 'GREEN').length;
  const unsyncedCount = patients.filter((p) => p.synced === 0).length;

  const avgMEWS = useMemo(() => {
    if (patients.length === 0) return '0.0';
    const sum = patients.reduce((acc, p) => acc + (p.mews?.score || 0), 0);
    return (sum / patients.length).toFixed(1);
  }, [patients]);

  const handleResetDemoData = async () => {
    if (confirm('Reset database back to standard demonstration telemetry dataset?')) {
      await resetDatabase();
      if (onRefresh) onRefresh();
      if (onShowToast) onShowToast('Database reset to clean demo state.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Stat Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Patients */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              TOTAL TRIAGE CASES
            </span>
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {totalCount}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Patients Registered
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 font-bold">{greenCount} Stable</span>
            <span>•</span>
            <span className="text-amber-400 font-bold">{yellowCount} Urgent</span>
          </div>
        </div>

        {/* Active Red Alerts */}
        <div className={`bg-slate-900/80 border rounded-xl p-4 shadow-lg backdrop-blur-sm transition-all ${
          redCount > 0 
            ? 'border-rose-500/50 shadow-rose-950/30 triage-glow-red' 
            : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              {redCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
              CRITICAL RED FLAGS
            </span>
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-rose-400">
              {redCount}
            </span>
            <span className="text-xs font-mono text-rose-300/80">
              Immediate Resuscitation
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-rose-400/90 font-semibold">
            {redCount > 0 ? 'Protocol Code Red Active (< 5 min)' : 'Zero critical alerts active'}
          </div>
        </div>

        {/* Unsynced Air-Gap Queue */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
              AIR-GAP QUEUE (LOCAL)
            </span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <CloudOff className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-cyan-300">
              {unsyncedCount}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Pending Replication
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">
              {isAirGapMode ? 'Air-Gap Isolation Active' : 'Online / District Linked'}
            </span>
            <button
              type="button"
              onClick={() => setShowSyncConsole(true)}
              className="text-[11px] font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Open Console →
            </button>
          </div>
        </div>

        {/* Mean MEWS Index */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              AVERAGE MEWS SCORE
            </span>
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {avgMEWS}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Acuity Metric
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-slate-400">
            System Mean Severity (Max: 14)
          </div>
        </div>

      </div>

      {/* Main Table Controls & Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('ALL'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>All Cases</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
                {totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('RED'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'RED'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-950'
                  : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-slate-800'
              }`}
            >
              <span>Critical Red</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-950/60 text-[10px]">
                {redCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('YELLOW'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'YELLOW'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
              }`}
            >
              <span>Urgent Yellow</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950/60 text-[10px]">
                {yellowCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('GREEN'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'GREEN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-slate-800'
              }`}
            >
              <span>Stable Green</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-[10px]">
                {greenCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { playKeypadBeep(); setActiveTab('UNSYNCED'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'UNSYNCED'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800'
              }`}
            >
              <span>Needs Sync</span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-950/60 text-[10px]">
                {unsyncedCount}
              </span>
            </button>
          </div>

          {/* Search Input & Demo Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, triage ID, complaint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowSyncConsole(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono rounded-lg transition border border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Terminal className="w-3.5 h-3.5" />
              Sync Console
            </button>

            <button
              type="button"
              onClick={handleResetDemoData}
              title="Reset Database to Clean Demo Set"
              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Live Patient Telemetry Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950/80 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Triage Status</th>
                <th className="py-3 px-4">Patient Dossier</th>
                <th className="py-3 px-4">Chief Complaint</th>
                <th className="py-3 px-4">Physiological Vitals</th>
                <th className="py-3 px-4">Replication State</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    No clinical records matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const isRed = patient.level === 'RED';
                  const isYellow = patient.level === 'YELLOW';
                  const mewsScore = patient.mews?.score ?? 0;
                  const formattedTime = new Date(patient.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`hover:bg-slate-800/40 transition cursor-pointer group ${
                        isRed ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Triage Status Pill */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-xs font-mono font-extrabold rounded-full border flex items-center gap-1.5 ${
                            isRed
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                              : isYellow
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isRed ? 'bg-rose-400' : isYellow ? 'bg-amber-400' : 'bg-emerald-400'
                            }`} />
                            CODE {patient.level}
                          </span>
                          <span className="font-mono font-bold text-xs text-white">
                            MEWS: {mewsScore}
                          </span>
                        </div>
                      </td>

                      {/* Patient Dossier */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white group-hover:text-cyan-300 transition">
                          {patient.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {patient.age}y • {patient.sex} • <span className="text-cyan-400">{patient.triageId}</span>
                        </div>
                      </td>

                      {/* Chief Complaint */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-xs text-slate-300 truncate">
                          {patient.chiefComplaint || 'Routine assessment'}
                        </p>
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {formattedTime} • Unit: {patient.originUnit || 'Field Unit'}
                        </span>
                      </td>

                      {/* Core Vitals */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <span title="Blood Pressure">BP: <strong className="text-white">{patient.vitals?.systolicBP}/{patient.vitals?.diastolicBP || '–'}</strong></span>
                          <span>•</span>
                          <span title="Heart Rate">HR: <strong className="text-white">{patient.vitals?.heartRate}</strong></span>
                          <span>•</span>
                          <span title="Respiratory Rate">RR: <strong className="text-white">{patient.vitals?.respRate}</strong></span>
                          <span>•</span>
                          <span title="Temperature">T: <strong className="text-white">{patient.vitals?.temperature}°</strong></span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          AVPU: <strong className="text-purple-300">{patient.vitals?.avpu}</strong> | SpO2: <strong className="text-cyan-300">{patient.vitals?.spo2 || 98}%</strong>
                        </div>
                      </td>

                      {/* Replication State */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {patient.synced ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                            <Cloud className="w-3.5 h-3.5" />
                            <span>District Cloud</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px]">
                            <CloudOff className="w-3.5 h-3.5" />
                            <span>Air-Gapped (Local)</span>
                          </div>
                        )}
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQrModalPatient(patient)}
                            title="Generate Air-Gap Optical QR Token"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded border border-slate-700 transition"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPatient(patient)}
                            title="Open Patient Telemetry Drawer"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onUpdated={onRefresh}
          onDeleted={onRefresh}
          onShowToast={onShowToast}
        />
      )}

      {/* Air-Gap QR Modal */}
      {qrModalPatient && (
        <AirGapModal
          patient={qrModalPatient}
          onClose={() => setQrModalPatient(null)}
          onTransferSuccess={(msg) => onShowToast && onShowToast(msg)}
        />
      )}

      {/* Sync Terminal Console Modal */}
      <SyncConsoleModal
        isOpen={showSyncConsole}
        onClose={() => setShowSyncConsole(false)}
        onSyncFinished={() => {
          if (onRefresh) onRefresh();
          if (onShowToast) onShowToast('Priority Background Sync Completed!');
        }}
      />

    </div>
  );
}
