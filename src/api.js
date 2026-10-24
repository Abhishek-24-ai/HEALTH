/**
 * Live Render Backend API Client for Aura-Triage
 * Connects directly to the live Render web service (https://abizz.onrender.com)
 * with graceful offline timeout and fallbacks.
 */

export const BACKEND_BASE_URL = (
  import.meta.env.VITE_BACKEND_URL || 'https://abizz.onrender.com'
).replace(/\/+$/, '');

/**
 * Health check for the Render Express backend
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { online: true, ...data };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Sync batch of patient records to Render backend
 * Payload format expected by server: { records: [...] }
 */
export async function syncPatientsToBackend(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { success: true, count: 0 };
  }

  // Format records for the Express server
  const formattedRecords = records.map((p) => ({
    patientUuid: p.patientUuid || p.patient_uuid,
    triageId: p.triageId || p.triage_id,
    name: p.name,
    age: p.age,
    gender: p.sex || p.gender,
    level: p.level,
    mewsScore: p.mews?.score ?? p.mews_score ?? p.mewsScore ?? 0,
    vitals: p.vitals || {},
    chiefComplaint: p.chiefComplaint || p.chief_complaint || '',
    originUnit: p.originUnit || p.origin_unit || 'Air-Gap Node',
    timestamp: p.timestamp || Date.now(),
  }));

  const res = await fetch(`${BACKEND_BASE_URL}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ records: formattedRecords }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Render Backend Sync Error (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Fetch patient queue from Render backend
 */
export async function fetchBackendPatients() {
  const res = await fetch(`${BACKEND_BASE_URL}/api/patients`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch backend queue: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Reset patient queue on Render backend
 */
export async function resetBackendPatients() {
  const res = await fetch(`${BACKEND_BASE_URL}/api/patients`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    throw new Error(`Failed to reset backend queue: HTTP ${res.status}`);
  }

  return await res.json();
}
