// Load environment variables if available (Node 20.6+)
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL;

// CORS configuration supporting production Vercel frontend, local dev, and air-gap proxies
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permissive for mobile triage devices, air-gap relays, and configured frontends
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// In-memory queue to store synced patient records on Render
let patientQueue = [];

// Root health & service discovery
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'AURA-TRIAGE Emergency Hospital Telemetry Server',
    version: '2.4-MED',
    endpoints: {
      health: 'GET /api/health',
      patients: 'GET /api/patients',
      sync: 'POST /api/sync',
      reset: 'DELETE /api/patients',
    },
    activePatients: patientQueue.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptime: process.uptime(),
    activePatients: patientQueue.length,
    timestamp: new Date().toISOString(),
  });
});

// Sync endpoint for offline field devices
app.post('/api/sync', (req, res) => {
  const { records } = req.body;
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Payload must contain a "records" array' });
  }

  // Deduplicate by patientUuid so resending packets doesn't duplicate patients
  const existingUuids = new Set(patientQueue.map((p) => p.patientUuid));
  const newRecords = records.filter((r) => r.patientUuid && !existingUuids.has(r.patientUuid));

  patientQueue = [...newRecords, ...patientQueue];

  console.log(`\n--- [INCOMING AIR-GAP SYNC] ---`);
  console.log(`Received ${records.length} patients (${newRecords.length} newly registered):`);
  records.forEach((pt) => {
    console.log(`- [${pt.level}] ${pt.name} (UUID: ${pt.patientUuid}) | MEWS: ${pt.mewsScore}`);
  });

  res.json({
    success: true,
    count: records.length,
    newCount: newRecords.length,
    total: patientQueue.length,
  });
});

// Endpoint for Hospital Emergency Dashboard
app.get('/api/patients', (req, res) => {
  res.json({
    total: patientQueue.length,
    criticalCount: patientQueue.filter((p) => p.level === 'RED').length,
    urgentCount: patientQueue.filter((p) => p.level === 'YELLOW').length,
    stableCount: patientQueue.filter((p) => p.level === 'GREEN').length,
    records: patientQueue,
  });
});

// Reset patient queue
app.delete('/api/patients', (req, res) => {
  patientQueue = [];
  res.json({ success: true, message: 'Emergency patient queue reset to zero' });
});

app.listen(PORT, () => {
  console.log(`Aura-Triage Hospital Server listening on port ${PORT}`);
});
