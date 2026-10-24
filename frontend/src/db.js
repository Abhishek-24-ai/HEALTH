import Dexie from 'dexie';
import { calculateMEWS } from './utils/mews';

/**
 * AuraTriageDB - Offline IndexedDB for Air-Gapped Field Clinics
 * Built using Dexie for fast, offline, transaction-safe storage.
 */
export const db = new Dexie('AuraTriageDB');

db.version(1).stores({
  patients: '++id, patientUuid, level, synced, timestamp, triageId',
  syncLogs: '++id, timestamp, level, count',
});

/**
 * Inserts a new patient record into local IndexedDB
 */
export async function addPatientRecord(record) {
  const patientUuid = record.patientUuid || `PT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const triageId = record.triageId || `TRIAGE-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = record.timestamp || Date.now();
  
  // Calculate or verify MEWS
  const mews = record.mews || calculateMEWS(record.vitals);

  const entry = {
    ...record,
    patientUuid,
    triageId,
    timestamp,
    level: mews.level,
    mews,
    synced: record.synced !== undefined ? record.synced : 0, // 0 = unsynced, 1 = synced
    createdAt: new Date(timestamp).toISOString(),
    opticalTransfers: record.opticalTransfers || 0,
  };

  const id = await db.patients.add(entry);
  return { ...entry, id };
}

/**
 * Retrieves all patients ordered by most recent first
 */
export async function getAllPatients() {
  return await db.patients.orderBy('timestamp').reverse().toArray();
}

/**
 * Retrieves unsynced patients, prioritized for air-gap sync
 */
export async function getUnsyncedPatients() {
  return await db.patients.where('synced').equals(0).toArray();
}

/**
 * Updates a patient's sync status
 */
export async function markPatientAsSynced(id, serverAckId = null) {
  return await db.patients.update(id, {
    synced: 1,
    syncedAt: Date.now(),
    serverAckId: serverAckId || `ACK-HOSP-${Date.now().toString(36).toUpperCase()}`,
  });
}

/**
 * Updates patient vitals & recalculates MEWS
 */
export async function updatePatientVitals(id, newVitals) {
  const existing = await db.patients.get(id);
  if (!existing) throw new Error('Patient not found');

  const mews = calculateMEWS(newVitals);
  const vitalsHistory = existing.vitalsHistory || [];
  vitalsHistory.push({
    timestamp: existing.timestamp,
    vitals: existing.vitals,
    mews: existing.mews,
  });

  return await db.patients.update(id, {
    vitals: newVitals,
    mews,
    level: mews.level,
    vitalsHistory,
    timestamp: Date.now(),
    synced: 0, // Marked as dirty for sync
  });
}

/**
 * Increment optical transfer counter
 */
export async function recordOpticalTransfer(id) {
  const p = await db.patients.get(id);
  if (p) {
    await db.patients.update(id, {
      opticalTransfers: (p.opticalTransfers || 0) + 1,
      lastTransferredAt: Date.now(),
    });
  }
}

/**
 * Delete a patient record
 */
export async function deletePatientRecord(id) {
  return await db.patients.delete(id);
}

/**
 * No-op: Demo data auto-seeding removed per user configuration.
 * Real incoming air-gap transfers and intake registrations will populate the database.
 */
export async function seedDemoPatientsIfEmpty() {
  return false;
}

/**
 * Resets database back to clean empty state
 */
export async function resetDatabase() {
  await db.patients.clear();
  return true;
}

export async function clearAllPatients() {
  await db.patients.clear();
  return true;
}

