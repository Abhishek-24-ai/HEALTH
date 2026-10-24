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
 * Seed sample field hospital patients if database is freshly initialized
 */
export async function seedDemoPatientsIfEmpty() {
  const count = await db.patients.count();
  if (count > 0) return false;

  const now = Date.now();
  const demoSeed = [
    {
      patientUuid: 'PT-SEPSIS-774A',
      triageId: 'TRIAGE-9102',
      name: 'Elena Rostova',
      age: 48,
      sex: 'Female',
      chiefComplaint: 'Altered mental status, severe rigors, septic shock secondary to acute pyelonephritis',
      allergies: 'Penicillin, Sulfa',
      medicalHistory: 'Type 2 Diabetes, Splenectomy',
      vitals: {
        systolicBP: 65,
        diastolicBP: 40,
        heartRate: 138,
        respRate: 32,
        temperature: 39.4,
        avpu: 'V',
        spo2: 89,
        bloodGlucose: 215,
      },
      synced: 0,
      timestamp: now - 18 * 60 * 1000,
      originUnit: 'Forward Outpost Charlie',
    },
    {
      patientUuid: 'PT-TRAUMA-410B',
      triageId: 'TRIAGE-8841',
      name: 'Marcus Brody',
      age: 29,
      sex: 'Male',
      chiefComplaint: 'High-speed blast/debris trauma, unstable pelvic girdle, blunt abdominal trauma',
      allergies: 'NKDA',
      medicalHistory: 'None',
      vitals: {
        systolicBP: 78,
        diastolicBP: 48,
        heartRate: 132,
        respRate: 28,
        temperature: 34.6,
        avpu: 'P',
        spo2: 91,
        bloodGlucose: 110,
      },
      synced: 0,
      timestamp: now - 34 * 60 * 1000,
      originUnit: 'Mobile Field Ambulance 3',
    },
    {
      patientUuid: 'PT-PEDIATRIC-102C',
      triageId: 'TRIAGE-7320',
      name: 'Mateo Morales',
      age: 7,
      sex: 'Male',
      chiefComplaint: 'Persistent high fever, severe dehydration, lethargy, decreased skin turgor',
      allergies: 'NKDA',
      medicalHistory: 'Asthma',
      vitals: {
        systolicBP: 98,
        diastolicBP: 62,
        heartRate: 112,
        respRate: 22,
        temperature: 39.1,
        avpu: 'A',
        spo2: 96,
        bloodGlucose: 104,
      },
      synced: 1,
      timestamp: now - 65 * 60 * 1000,
      originUnit: 'Rural Health Sub-Center 14',
    },
    {
      patientUuid: 'PT-STABLE-901D',
      triageId: 'TRIAGE-6140',
      name: 'Amara Vance',
      age: 34,
      sex: 'Female',
      chiefComplaint: 'Mild sprained left ankle during field evacuation, alert and ambulatory',
      allergies: 'Latex',
      medicalHistory: 'None',
      vitals: {
        systolicBP: 122,
        diastolicBP: 78,
        heartRate: 72,
        respRate: 14,
        temperature: 36.8,
        avpu: 'A',
        spo2: 99,
        bloodGlucose: 92,
      },
      synced: 1,
      timestamp: now - 120 * 60 * 1000,
      originUnit: 'Rural Health Sub-Center 14',
    },
  ];

  for (const item of demoSeed) {
    const mews = calculateMEWS(item.vitals);
    await db.patients.add({
      ...item,
      level: mews.level,
      mews,
      createdAt: new Date(item.timestamp).toISOString(),
      opticalTransfers: 1,
    });
  }

  return true;
}

/**
 * Resets database back to clean demo dataset
 */
export async function resetDatabase() {
  await db.patients.clear();
  return await seedDemoPatientsIfEmpty();
}
