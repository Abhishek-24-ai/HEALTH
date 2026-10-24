import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ShieldAlert,
  Database,
  Radio,
  Copy,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import PatientDetailModal from './PatientDetailModal';
import AirGapModal from './AirGapModal';
import SyncConsoleModal from './SyncConsoleModal';
import { resetDatabase } from '../db';
import { playKeypadBeep, playScanSuccessSound, playRedAlertSound } from '../utils/audioAlert';
import { supabase, isSupabaseConfigured, SUPABASE_PATIENTS_TABLE_SQL } from '../supabaseClient';
import { calculateMEWS } from '../utils/mews';
import { BACKEND_BASE_URL, fetchBackendPatients } from '../api';

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
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Cloud telemetry states
  const [cloudPatients, setCloudPatients] = useState([]);
  const [dataSource, setDataSource] = useState('HYBRID'); // 'HYBRID' | 'CLOUD_ONLY' | 'LOCAL_ONLY'
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);

  // Fetch telemetry records from Supabase and Render backend
  const fetchSupabasePatients = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    setIsCloudLoading(true);
    const combinedCloud = [];

    // 1. Fetch from Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          data.forEach((row) => {
            const vitals = row.vitals || {};
            const mewsCalc = calculateMEWS(vitals);
            combinedCloud.push({
              id: `cloud-sb-${row.id}`,
              patientUuid: row.patient_uuid,
              triageId: row.triage_id || `TRIAGE-${row.id}`,
              name: row.name,
              age: row.age,
              sex: row.gender || 'Unknown',
              chiefComplaint: row.chief_complaint,
              allergies: row.allergies || 'NKDA',
              medicalHistory: row.medical_history || '',
              vitals,
              mews: {
                score: row.mews_score ?? mewsCalc.score,
                level: row.level || mewsCalc.level,
                breakdown: mewsCalc.breakdown,
                clinicalAction: mewsCalc.clinicalAction,
                urgencyLabel: mewsCalc.urgencyLabel,
                responseTime: mewsCalc.responseTime,
                styleClasses: mewsCalc.styleClasses,
              },
              level: row.level || mewsCalc.level,
              synced: 1,
              timestamp: new Date(row.created_at || row.synced_at).getTime(),
              originUnit: row.origin_unit || 'Supabase PostgreSQL',
              opticalTransfers: row.optical_transfers || 0,
              isFromCloud: true,
            });
          });
        }
      } catch (err) {
        console.warn('Supabase fetch notice:', err);
      }
    }

    // 2. Fetch from Live Render backend
    try {
      const renderRes = await fetchBackendPatients();
      if (renderRes && Array.isArray(renderRes.records)) {
        renderRes.records.forEach((row, idx) => {
          // Avoid duplicate if already pulled from Supabase
          if (combinedCloud.some((c) => c.patientUuid === row.patientUuid)) return;

          const vitals = row.vitals || {};
          const mewsCalc = calculateMEWS(vitals);
          combinedCloud.push({
            id: `cloud-render-${idx}-${row.patientUuid}`,
            patientUuid: row.patientUuid,
            triageId: row.triageId || `TRIAGE-${idx}`,
            name: row.name,
            age: row.age,
            sex: row.gender || 'Unknown',
            chiefComplaint: row.chiefComplaint,
            allergies: row.allergies || 'NKDA',
            medicalHistory: row.medicalHistory || '',
            vitals,
            mews: {
              score: row.mewsScore ?? mewsCalc.score,
              level: row.level || mewsCalc.level,
              breakdown: mewsCalc.breakdown,
              clinicalAction: mewsCalc.clinicalAction,
              urgencyLabel: mewsCalc.urgencyLabel,
              responseTime: mewsCalc.responseTime,
              styleClasses: mewsCalc.styleClasses,
            },
            level: row.level || mewsCalc.level,
            synced: 1,
            timestamp: row.timestamp || Date.now(),
            originUnit: row.originUnit || 'Render Backend API',
            opticalTransfers: 0,
            isFromCloud: true,
          });
        });
      }
    } catch (renderErr) {
      // Backend may be sleeping (Render free tier cold start) or unpopulated
      console.warn('Render backend notice:', renderErr.message);
    }

    setCloudPatients(combinedCloud);
    setIsCloudLoading(false);
  }, []);


  // Supabase Realtime channel subscription
  useEffect(() => {
    if (!isSupabaseConfigured || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setRealtimeActive(false);
      return;
    }

    fetchSupabasePatients();

    let channel = null;
    try {
      channel = supabase
        .channel('public:patients')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'patients' },
          (payload) => {
            fetchSupabasePatients();
            
            if (payload.eventType === 'INSERT') {
              playScanSuccessSound();
              const newPt = payload.new;
              if (newPt?.level === 'RED') {
                playRedAlertSound();
              }
              if (onShowToast) {
                onShowToast(`REALTIME TELEMETRY: New patient ${newPt?.name || 'Emergency'} received from cloud!`);
              }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeActive(true);
          } else {
            setRealtimeActive(false);
          }
        });
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchSupabasePatients, onShowToast]);

  // Combine and deduplicate records based on patientUuid
  const combinedPatients = useMemo(() => {
    if (dataSource === 'CLOUD_ONLY') {
      return cloudPatients;
    }
    if (dataSource === 'LOCAL_ONLY') {
      return patients;
    }

    // HYBRID MODE: Merge Supabase cloud records with local IndexedDB records
    const localMap = new Map();
    patients.forEach((p) => localMap.set(p.patientUuid, p));

    // For any cloud record, if local exists and is unsynced, keep local state; otherwise cloud record
    const merged = [...patients];
    cloudPatients.forEach((cp) => {
      const existingIdx = merged.findIndex((p) => p.patientUuid === cp.patientUuid);
      if (existingIdx !== -1) {
        // If local is synced, replace with cloud record
        if (merged[existingIdx].synced === 1) {
          merged[existingIdx] = cp;
        }
      } else {
        // New patient registered from another device
        merged.push(cp);
      }
    });

    return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [patients, cloudPatients, dataSource]);

  // Filter patients by tab and search query
  const filteredPatients = useMemo(() => {
    return combinedPatients.filter((patient) => {
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
  }, [combinedPatients, activeTab, searchQuery]);

  // Aggregate KPI metrics
  const totalCount = combinedPatients.length;
  const redCount = combinedPatients.filter((p) => p.level === 'RED').length;
  const yellowCount = combinedPatients.filter((p) => p.level === 'YELLOW').length;
  const greenCount = combinedPatients.filter((p) => p.level === 'GREEN').length;
  const unsyncedCount = combinedPatients.filter((p) => p.synced === 0).length;

  const avgMEWS = useMemo(() => {
    if (combinedPatients.length === 0) return '0.0';
    const sum = combinedPatients.reduce((acc, p) => acc + (p.mews?.score || 0), 0);
    return (sum / combinedPatients.length).toFixed(1);
  }, [combinedPatients]);

  const handleResetDemoData = async () => {
    if (confirm('Reset local database back to standard demonstration telemetry dataset?')) {
      await resetDatabase();
      if (onRefresh) onRefresh();
      if (onShowToast) onShowToast('Database reset to clean demo state.');
    }
  };

  const copySqlSchema = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_PATIENTS_TABLE_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
      if (onShowToast) onShowToast('Supabase SQL Migration copied to clipboard!');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Telemetry Data-Source Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4 backdrop-blur-md shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border flex items-center justify-center ${
            realtimeActive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : isSupabaseConfigured
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <Database className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Telemetry Pipeline: Live Render API ({BACKEND_BASE_URL}) + Supabase Cloud
              </h3>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                realtimeActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}>
                {realtimeActive ? 'REALTIME STREAMING' : 'ONLINE CLUSTER'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Live bi-directional synchronization enabled across field tablet nodes, Render web services, and Supabase PostgreSQL.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Data Source Segmented Toggle */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-[11px] font-mono">
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setDataSource('HYBRID'); }}
              className={`px-2.5 py-1 rounded transition ${
                dataSource === 'HYBRID' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hybrid
            </button>
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setDataSource('CLOUD_ONLY'); }}
              className={`px-2.5 py-1 rounded transition ${
                dataSource === 'CLOUD_ONLY' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cloud ({cloudPatients.length})
            </button>
            <button
              type="button"
              onClick={() => { playKeypadBeep(); setDataSource('LOCAL_ONLY'); }}
              className={`px-2.5 py-1 rounded transition ${
                dataSource === 'LOCAL_ONLY' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Local ({patients.length})
            </button>
          </div>

          <button
            type="button"
            onClick={fetchSupabasePatients}
            disabled={isCloudLoading}
            title="Refresh Supabase cloud feed"
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCloudLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono rounded-lg transition border border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Schema</span>
          </button>
        </div>
      </div>

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
              Patients In Queue
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
              {isAirGapMode ? 'Air-Gap Isolation Active' : 'District Linked'}
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                      key={patient.id || patient.patientUuid}
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
                        <div className="font-bold text-white group-hover:text-cyan-300 transition flex items-center gap-2">
                          <span>{patient.name}</span>
                          {patient.isFromCloud && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[9px] font-mono font-normal">
                              Cloud
                            </span>
                          )}
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
                            <span>{patient.isFromCloud ? 'Supabase Realtime' : 'District Cloud'}</span>
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
          onUpdated={() => {
            if (onRefresh) onRefresh();
            fetchSupabasePatients();
          }}
          onDeleted={() => {
            if (onRefresh) onRefresh();
            fetchSupabasePatients();
          }}
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
          fetchSupabasePatients();
          if (onShowToast) onShowToast('Priority Background Sync Completed!');
        }}
      />

      {/* Supabase SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Supabase SQL Table Schema (`public.patients`)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Copy and run this in your Supabase SQL Editor to enable cloud triage
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1">
                <span className="text-cyan-400 font-bold block">Setup Instructions:</span>
                <div>1. Log into your Supabase Dashboard: <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-cyan-400 underline inline-flex items-center gap-1">supabase.com <ExternalLink className="w-3 h-3" /></a></div>
                <div>2. Open the <strong>SQL Editor</strong> tab on the left navigation bar.</div>
                <div>3. Paste and run the SQL below to create the schema, RLS policies, and enable Realtime replication.</div>
                <div>4. Copy your Project URL & Anon Key into <code>.env</code> in your project root.</div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-[340px]">
                  {SUPABASE_PATIENTS_TABLE_SQL}
                </pre>

                <button
                  type="button"
                  onClick={copySqlSchema}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono rounded-lg transition border border-slate-700 flex items-center gap-1.5 shadow"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Table: public.patients • Realtime: Enabled</span>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
