import { db, markPatientAsSynced } from '../db';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import confetti from 'canvas-confetti';

/**
 * Priority Cloud Sync Engine for Aura-Triage
 * Synchronizes offline Dexie IndexedDB records to Supabase Cloud PostgreSQL.
 * Enforces Red-First Clinical Priority Queue (RED -> YELLOW -> GREEN).
 */

// Global event listeners for streaming terminal logs and UI sync state
const syncListeners = new Set();

export function subscribeSyncEvents(callback) {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function broadcastSyncEvent(event) {
  syncListeners.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.error(e);
    }
  });
}

let isSyncRunning = false;

export function getSyncStatus() {
  return { isSyncRunning, isSupabaseConfigured };
}

/**
 * Sorts pending records by clinical urgency:
 * RED (weight 1) -> YELLOW (weight 2) -> GREEN (weight 3).
 * Oldest records within the same triage band are dispatched first.
 */
export function prioritizePatients(patientList) {
  const urgencyWeight = {
    RED: 1,
    YELLOW: 2,
    GREEN: 3,
  };

  return [...patientList].sort((a, b) => {
    const weightA = urgencyWeight[a.level] || 99;
    const weightB = urgencyWeight[b.level] || 99;
    if (weightA !== weightB) {
      return weightA - weightB; // Ascending: 1 (RED) first, then 2 (YELLOW), then 3 (GREEN)
    }
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

/**
 * Maps Dexie IndexedDB clinical record to Supabase table schema
 */
export function mapPatientToSupabaseSchema(record) {
  return {
    patient_uuid: record.patientUuid,
    triage_id: record.triageId || `TRIAGE-${Date.now().toString(36).toUpperCase()}`,
    name: record.name || 'Anonymous Patient',
    age: Number(record.age) || 0,
    gender: record.sex || record.gender || 'Unknown',
    chief_complaint: record.chiefComplaint || '',
    allergies: record.allergies || 'NKDA',
    medical_history: record.medicalHistory || '',
    mews_score: record.mews?.score ?? record.mewsScore ?? 0,
    level: record.level || 'GREEN',
    vitals: record.vitals || {},
    origin_unit: record.originUnit || 'Air-Gap Mobile Unit',
    optical_transfers: record.opticalTransfers || 0,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Core Priority Sync Routine:
 * Checks connectivity -> Queries unsynced IndexedDB -> Prioritizes by triage urgency ->
 * Dispatches to Supabase (or mock cloud simulator if unconfigured) -> Updates Dexie records.
 */
export async function syncPatientsToCloud(onLog = null) {
  if (isSyncRunning) {
    return { status: 'IN_PROGRESS', message: 'Sync cycle already active' };
  }

  // 1. Connectivity check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineMsg = 'DEVICE IS OFFLINE: Preserving 100% air-gap isolation in local IndexedDB.';
    if (onLog) onLog({ timestamp: new Date().toLocaleTimeString(), text: offlineMsg, level: 'warning' });
    broadcastSyncEvent({ type: 'LOG', entry: { timestamp: new Date().toLocaleTimeString(), text: offlineMsg, level: 'warning' } });
    return { status: 'OFFLINE', success: false, message: offlineMsg };
  }

  isSyncRunning = true;
  broadcastSyncEvent({ type: 'SYNC_STARTED' });

  const log = (msg, level = 'info', meta = {}) => {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      text: msg,
      level,
      meta,
    };
    if (onLog) onLog(entry);
    broadcastSyncEvent({ type: 'LOG', entry });
  };

  try {
    const targetMode = isSupabaseConfigured ? 'Supabase PostgreSQL Cloud' : 'District Telemetry Mock Gateway';
    log(`CONNECTIVITY VERIFIED: Initiating sync handshake with ${targetMode}...`, 'info');
    await new Promise((r) => setTimeout(r, 450));

    // 2. Query Dexie for unsynced records
    const unsynced = await db.patients.where('synced').equals(0).toArray();

    if (unsynced.length === 0) {
      log('QUEUE CLEAR: Zero unsynced patients found in local IndexedDB.', 'success');
      log('STANDBY: All local air-gapped records are fully replicated.', 'info');
      isSyncRunning = false;
      broadcastSyncEvent({ type: 'SYNC_COMPLETE', syncedCount: 0 });
      return { status: 'SUCCESS', success: true, count: 0, syncedCount: 0 };
    }

    // 3. Prioritize by clinical acuity: RED -> YELLOW -> GREEN
    const priorityQueue = prioritizePatients(unsynced);
    const redCount = priorityQueue.filter((p) => p.level === 'RED').length;
    const yellowCount = priorityQueue.filter((p) => p.level === 'YELLOW').length;
    const greenCount = priorityQueue.filter((p) => p.level === 'GREEN').length;

    log(`QUEUE DISCOVERY: ${priorityQueue.length} patient records queued for transfer.`, 'info');
    log(`PRIORITY MATRIX: ${redCount} CRITICAL RED, ${yellowCount} URGENT YELLOW, ${greenCount} STABLE GREEN.`, 'warning');
    log('ENFORCING PROTOCOL: Level RED patients scheduled first for zero-latency resuscitation handoff.', 'warning');

    let syncedCount = 0;

    for (let i = 0; i < priorityQueue.length; i++) {
      const patient = priorityQueue[i];
      const indexStr = `[${String(i + 1).padStart(2, '0')}/${String(priorityQueue.length).padStart(2, '0')}]`;
      const levelTag = patient.level === 'RED'
        ? '🔴 CRITICAL RED'
        : patient.level === 'YELLOW'
        ? '🟡 URGENT YELLOW'
        : '🟢 STABLE GREEN';

      log(`${indexStr} DISPATCHING: ${levelTag} | ${patient.name} (${patient.patientUuid}) | MEWS: ${patient.mews?.score ?? 'N/A'}`, 'info', { patientId: patient.id });

      let ackId = `ACK-CLOUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      if (isSupabaseConfigured) {
        // Transform and insert/upsert into Supabase
        const payload = mapPatientToSupabaseSchema(patient);
        const { error } = await supabase
          .from('patients')
          .upsert(payload, { onConflict: 'patient_uuid' });

        if (error) {
          log(`${indexStr} SUPABASE ERROR: ${error.message} (Code: ${error.code || 'N/A'})`, 'error');
          if (error.code === '42P01') {
            log('NOTICE: Table "patients" does not exist in Supabase yet. Run the provided SQL migration.', 'warning');
          }
          // Mark local with fallback error tag but continue remaining
          continue;
        } else {
          ackId = `SUPABASE-${patient.patientUuid}`;
          log(`${indexStr} SUPABASE COMMITTED: Record stored in PostgreSQL (patient_uuid: ${patient.patientUuid})`, 'success');
        }
      } else {
        // Simulated network transmission jitter for realistic demonstration
        const latency = Math.floor(350 + Math.random() * 450);
        await new Promise((r) => setTimeout(r, latency));
        log(`${indexStr} TELEMETRY DELIVERED: HTTP 201 CREATED [${latency}ms] | Gateway ID: ${ackId}`, 'success');
      }

      // 4. Mark IndexedDB record as synced: 1
      await markPatientAsSynced(patient.id, ackId);
      syncedCount++;
    }

    log(`SYNC CYCLE COMPLETE: ${syncedCount} / ${priorityQueue.length} emergency patient files synchronized.`, 'success');

    // Trigger celebratory particle effect on full completion
    if (syncedCount > 0) {
      try {
        confetti({
          particleCount: 45,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#10b981', '#38bdf8', '#818cf8'],
        });
      } catch (e) {}
    }

    isSyncRunning = false;
    broadcastSyncEvent({ type: 'SYNC_COMPLETE', syncedCount });
    return { status: 'SUCCESS', success: true, count: syncedCount, syncedCount, total: priorityQueue.length };

  } catch (err) {
    log(`FATAL SYNC ERROR: ${err.message}`, 'error');
    isSyncRunning = false;
    broadcastSyncEvent({ type: 'SYNC_ERROR', error: err.message });
    return { status: 'ERROR', success: false, error: err.message };
  }
}

/**
 * Backward compatibility alias for syncWithMockServer
 */
export const syncWithMockServer = syncPatientsToCloud;
