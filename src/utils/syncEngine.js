import { db, markPatientAsSynced } from '../db';
import confetti from 'canvas-confetti';

/**
 * Red-First Priority Sync Engine for District Hospital Cloud Sync
 * Automatically prioritizes critical patient records before stable records.
 */

// Global listeners for sync events
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
  return { isSyncRunning };
}

/**
 * Sorts pending records so RED triage patients sync first, followed by YELLOW, then GREEN,
 * then oldest timestamp first within the same level.
 */
export function prioritizePatients(patientList) {
  const levelWeight = {
    RED: 3,
    YELLOW: 2,
    GREEN: 1,
  };

  return [...patientList].sort((a, b) => {
    const weightA = levelWeight[a.level] || 0;
    const weightB = levelWeight[b.level] || 0;
    if (weightA !== weightB) {
      return weightB - weightA; // Descending: 3 (RED) first, then 2 (YELLOW), then 1 (GREEN)
    }
    // Tie breaker: oldest first
    return (a.timestamp || 0) - (b.timestamp || 0);
  });
}

/**
 * Execute simulated cloud synchronization with realistic network jitter and step-by-step logs
 */
export async function syncWithMockServer(onLog = null) {
  if (isSyncRunning) {
    return { success: false, message: 'Sync already in progress' };
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
    log('CONNECTING: Initiating TLS handshake with District Emergency Cloud (vitals.hospital-district.net:443)...', 'info');
    await new Promise((r) => setTimeout(r, 600));

    // Fetch all unsynced patients
    const unsynced = await db.patients.where('synced').equals(0).toArray();

    if (unsynced.length === 0) {
      log('QUEUE CLEAR: Zero pending unsynced records found in local air-gap store.', 'success');
      log('STANDBY: District cloud is fully mirrored with local node.', 'info');
      isSyncRunning = false;
      broadcastSyncEvent({ type: 'SYNC_COMPLETE', syncedCount: 0 });
      return { success: true, count: 0 };
    }

    // Sort with Red-First Priority Queue
    const priorityQueue = prioritizePatients(unsynced);
    const redCount = priorityQueue.filter((p) => p.level === 'RED').length;
    const yellowCount = priorityQueue.filter((p) => p.level === 'YELLOW').length;
    const greenCount = priorityQueue.filter((p) => p.level === 'GREEN').length;

    log(`QUEUE DISCOVERY: ${priorityQueue.length} records pending transfer. [PRIORITY BREAKDOWN: ${redCount} CRITICAL RED, ${yellowCount} URGENT YELLOW, ${greenCount} GREEN]`, 'info');
    log('ENFORCING PROTOCOL: Level RED patients scheduled first for zero-latency hospital telemetry ingestion.', 'warning');

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

      // Simulated packet compression and upload latency
      const latency = Math.floor(400 + Math.random() * 500);
      await new Promise((r) => setTimeout(r, latency));

      const ackId = `ACK-CLOUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      // Update IndexedDB
      await markPatientAsSynced(patient.id, ackId);
      syncedCount++;

      log(`${indexStr} SUCCESS: HTTP 201 CREATED in ${latency}ms | Server Handshake ID: ${ackId}`, 'success', { patientId: patient.id });
    }

    log(`BATCH COMPLETE: ${syncedCount} / ${priorityQueue.length} emergency patient files transmitted and verified.`, 'success');
    log('INTEGRITY CHECK: SHA-256 telemetry digest matched on District Hospital Master Gateway.', 'success');

    // Trigger celebratory particle effect
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#38bdf8', '#818cf8'],
      });
    } catch (e) {}

    isSyncRunning = false;
    broadcastSyncEvent({ type: 'SYNC_COMPLETE', syncedCount });
    return { success: true, count: syncedCount };
  } catch (err) {
    log(`ERROR DURING SYNC: ${err.message}`, 'error');
    isSyncRunning = false;
    broadcastSyncEvent({ type: 'SYNC_ERROR', error: err.message });
    return { success: false, error: err.message };
  }
}
