import LZString from 'lz-string';
import { calculateMEWS } from './mews';

/**
 * Optical Air-Gap Patient Telemetry Transfer Protocol
 * Standardized high-density compression engine for camera-to-screen patient handoffs.
 */

const PROTOCOL_PREFIX = 'AURA1:';

/**
 * Minify patient keys to maximize QR code scanning reliability and data density.
 * Mapping:
 * u: patientUuid
 * t: triageId
 * n: name
 * a: age
 * s: sex
 * c: chiefComplaint
 * l: allergies
 * h: medicalHistory
 * v: vitals [sbp, dbp, hr, rr, temp, avpu, spo2, bg]
 * m: mews score integer
 * x: level ('RED', 'YELLOW', 'GREEN')
 * o: originUnit
 * z: timestamp
 */
export function compressPatientData(patient) {
  if (!patient) return null;

  const vitals = patient.vitals || {};
  const mews = patient.mews || calculateMEWS(vitals);

  // Compact array for vitals to minimize JSON keys
  const compactVitals = [
    Number(vitals.systolicBP) || 0,
    Number(vitals.diastolicBP) || 0,
    Number(vitals.heartRate) || 0,
    Number(vitals.respRate) || 0,
    Number(vitals.temperature) || 0,
    vitals.avpu || 'A',
    Number(vitals.spo2) || 98,
    Number(vitals.bloodGlucose) || 0,
  ];

  const minified = {
    u: patient.patientUuid,
    t: patient.triageId,
    n: patient.name || 'Anonymous Patient',
    a: Number(patient.age) || 0,
    s: patient.sex || 'Unknown',
    c: patient.chiefComplaint || '',
    l: patient.allergies || '',
    h: patient.medicalHistory || '',
    v: compactVitals,
    m: mews.score,
    x: mews.level,
    o: patient.originUnit || 'Air-Gap Unit 1',
    z: patient.timestamp || Date.now(),
  };

  const rawJson = JSON.stringify(minified);
  const compressed = LZString.compressToEncodedURIComponent(rawJson);
  const token = `${PROTOCOL_PREFIX}${compressed}`;

  const rawBytes = new Blob([JSON.stringify(patient)]).size;
  const compressedBytes = token.length;
  const ratio = Math.round((1 - compressedBytes / Math.max(rawBytes, 1)) * 100);

  return {
    token,
    rawBytes,
    compressedBytes,
    compressionRatio: Math.max(ratio, 0),
    minified,
  };
}

/**
 * Decompresses and validates an optical token back into a full patient object
 */
export function decompressPatientData(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Empty or invalid optical token');
  }

  const cleanToken = token.trim();
  let compressedPayload = cleanToken;

  if (cleanToken.startsWith(PROTOCOL_PREFIX)) {
    compressedPayload = cleanToken.slice(PROTOCOL_PREFIX.length);
  } else if (cleanToken.startsWith('AURA')) {
    // Tolerant match
    const colonIdx = cleanToken.indexOf(':');
    if (colonIdx !== -1) {
      compressedPayload = cleanToken.slice(colonIdx + 1);
    }
  }

  const decompressedJson = LZString.decompressFromEncodedURIComponent(compressedPayload);
  if (!decompressedJson) {
    throw new Error('Decompression failed. Payload may be corrupt or uncompressed.');
  }

  let minified;
  try {
    minified = JSON.parse(decompressedJson);
  } catch (err) {
    throw new Error('Invalid JSON structure after decompression: ' + err.message);
  }

  // Restore vitals array
  const rawV = Array.isArray(minified.v) ? minified.v : [];
  const vitals = {
    systolicBP: rawV[0] !== undefined ? rawV[0] : 120,
    diastolicBP: rawV[1] !== undefined ? rawV[1] : 80,
    heartRate: rawV[2] !== undefined ? rawV[2] : 75,
    respRate: rawV[3] !== undefined ? rawV[3] : 16,
    temperature: rawV[4] !== undefined ? rawV[4] : 36.6,
    avpu: rawV[5] || 'A',
    spo2: rawV[6] !== undefined ? rawV[6] : 98,
    bloodGlucose: rawV[7] !== undefined ? rawV[7] : 100,
  };

  const mews = calculateMEWS(vitals);

  const restoredPatient = {
    patientUuid: minified.u || `PT-IMPORT-${Date.now().toString(36).toUpperCase()}`,
    triageId: minified.t || `TRIAGE-OPTICAL`,
    name: minified.n || 'Imported Patient',
    age: minified.a || 0,
    sex: minified.s || 'Unknown',
    chiefComplaint: minified.c || 'No chief complaint provided',
    allergies: minified.l || 'NKDA',
    medicalHistory: minified.h || '',
    originUnit: minified.o || 'Air-Gap Optical Import',
    vitals,
    mews,
    level: mews.level,
    timestamp: minified.z || Date.now(),
    synced: 0,
    opticalIngestedAt: Date.now(),
  };

  return restoredPatient;
}
