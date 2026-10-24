/**
 * Deterministic Modified Early Warning Score (MEWS) Clinical Engine
 * Validated emergency triage scoring system for zero-connectivity clinical units.
 */

export const AVPU_OPTIONS = [
  { value: 'A', label: 'Alert (Normal responsive state)', points: 0 },
  { value: 'V', label: 'Voice (Responds to verbal stimuli)', points: 1 },
  { value: 'P', label: 'Pain (Responds only to painful stimuli)', points: 2 },
  { value: 'U', label: 'Unresponsive (Comatose / Flaccid)', points: 3 },
];

/**
 * Score individual physiological parameters
 */
export function scoreSystolicBP(systolic) {
  if (systolic === null || systolic === undefined || isNaN(systolic) || systolic === '') {
    return { points: 0, severity: 'normal', desc: 'Not recorded' };
  }
  const s = Number(systolic);
  if (s <= 70) return { points: 3, severity: 'critical', desc: '<=70 mmHg (Severe hypotension)' };
  if (s <= 80) return { points: 2, severity: 'urgent', desc: '71-80 mmHg (Moderate hypotension)' };
  if (s <= 100) return { points: 1, severity: 'warning', desc: '81-100 mmHg (Mild hypotension)' };
  if (s < 200) return { points: 0, severity: 'normal', desc: '101-199 mmHg (Normal)' };
  return { points: 2, severity: 'urgent', desc: '>=200 mmHg (Hypertensive crisis risk)' };
}

export function scoreHeartRate(hr) {
  if (hr === null || hr === undefined || isNaN(hr) || hr === '') {
    return { points: 0, severity: 'normal', desc: 'Not recorded' };
  }
  const h = Number(hr);
  if (h <= 40) return { points: 2, severity: 'urgent', desc: '<=40 bpm (Severe bradycardia)' };
  if (h <= 50) return { points: 1, severity: 'warning', desc: '41-50 bpm (Bradycardia)' };
  if (h <= 100) return { points: 0, severity: 'normal', desc: '51-100 bpm (Normal sinus rate)' };
  if (h <= 110) return { points: 1, severity: 'warning', desc: '101-110 bpm (Mild tachycardia)' };
  if (h <= 129) return { points: 2, severity: 'urgent', desc: '111-129 bpm (Moderate tachycardia)' };
  return { points: 3, severity: 'critical', desc: '>=130 bpm (Severe tachyarrhythmia)' };
}

export function scoreRespRate(rr) {
  if (rr === null || rr === undefined || isNaN(rr) || rr === '') {
    return { points: 0, severity: 'normal', desc: 'Not recorded' };
  }
  const r = Number(rr);
  if (r < 9) return { points: 2, severity: 'urgent', desc: '<9 bpm (Bradypnea / Hypoventilation)' };
  if (r <= 14) return { points: 0, severity: 'normal', desc: '9-14 bpm (Normal ventilation)' };
  if (r <= 20) return { points: 1, severity: 'warning', desc: '15-20 bpm (Mild tachypnea)' };
  if (r <= 29) return { points: 2, severity: 'urgent', desc: '21-29 bpm (Moderate tachypnea)' };
  return { points: 3, severity: 'critical', desc: '>=30 bpm (Respiratory distress)' };
}

export function scoreTemperature(temp) {
  if (temp === null || temp === undefined || isNaN(temp) || temp === '') {
    return { points: 0, severity: 'normal', desc: 'Not recorded' };
  }
  const t = Number(temp);
  if (t < 35.0) return { points: 2, severity: 'urgent', desc: '<35.0°C (Hypothermia)' };
  if (t <= 38.4) return { points: 0, severity: 'normal', desc: '35.0-38.4°C (Normothermia)' };
  return { points: 2, severity: 'urgent', desc: '>=38.5°C (Pyrexia / High fever)' };
}

export function scoreAVPU(avpu) {
  const code = (avpu || 'A').toUpperCase();
  switch (code) {
    case 'V':
      return { points: 1, severity: 'warning', desc: 'Voice (Reacts to voice)' };
    case 'P':
      return { points: 2, severity: 'urgent', desc: 'Pain (Reacts only to pain)' };
    case 'U':
      return { points: 3, severity: 'critical', desc: 'Unresponsive (Comatose)' };
    case 'A':
    default:
      return { points: 0, severity: 'normal', desc: 'Alert (Oriented)' };
  }
}

/**
 * Calculates complete MEWS score with protocol actions and risk categorization.
 * @param {Object} vitals
 * @returns {Object} score, level, clinicalAction, breakdown, details
 */
export function calculateMEWS(vitals = {}) {
  const bpScore = scoreSystolicBP(vitals.systolicBP);
  const hrScore = scoreHeartRate(vitals.heartRate);
  const rrScore = scoreRespRate(vitals.respRate);
  const tempScore = scoreTemperature(vitals.temperature);
  const avpuScore = scoreAVPU(vitals.avpu);

  const totalScore = bpScore.points + hrScore.points + rrScore.points + tempScore.points + avpuScore.points;

  let level = 'GREEN';
  let urgencyLabel = 'LOW ACUITY / ROUTINE WARD';
  let clinicalAction = 'Routine observation q4h. Patient hemodynamically stable. Continue standard supportive care.';
  let responseTime = '< 120 Minutes';
  let styleClasses = {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    border: 'border-emerald-500/30',
    glow: 'triage-glow-green',
    bg: 'bg-emerald-950/20',
    hex: '#10b981',
    ring: 'stroke-emerald-400',
  };

  if (totalScore >= 5) {
    level = 'RED';
    urgencyLabel = 'CRITICAL CODE RED - RESUSCITATION PROTOCOL';
    clinicalAction = 'IMMEDIATE LIFE-THREATENING RISK: High-flow O2 via non-rebreather, 2x large-bore IV access (16G/18G), initiate rapid crystalloid bolus, continuous ECG & SpO2 monitoring. Notify trauma/resuscitation lead immediately. Prepare air-gap medevac handoff.';
    responseTime = 'IMMEDIATE (< 5 Min)';
    styleClasses = {
      badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse',
      border: 'border-rose-500/40',
      glow: 'triage-glow-red',
      bg: 'bg-rose-950/30',
      hex: '#f43f5e',
      ring: 'stroke-rose-500',
    };
  } else if (totalScore >= 3) {
    level = 'YELLOW';
    urgencyLabel = 'URGENT - POTENTIAL RAPID DETERIORATION';
    clinicalAction = 'ESCALATE CARE: Bedside clinical assessment within 15-30 minutes. Repeat vitals every 15-30 min. Establish peripheral IV access, order emergency bloods, prepare supplemental oxygen if SpO2 drops below 94%. Inform senior medical officer.';
    responseTime = '< 30 Minutes';
    styleClasses = {
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      border: 'border-amber-500/30',
      glow: 'triage-glow-yellow',
      bg: 'bg-amber-950/25',
      hex: '#f59e0b',
      ring: 'stroke-amber-400',
    };
  }

  return {
    score: totalScore,
    level,
    urgencyLabel,
    clinicalAction,
    responseTime,
    styleClasses,
    breakdown: {
      systolicBP: bpScore,
      heartRate: hrScore,
      respRate: rrScore,
      temperature: tempScore,
      avpu: avpuScore,
    },
    // Maximum clinical benchmark on standard MEWS is 14
    percentage: Math.min(Math.round((totalScore / 14) * 100), 100),
  };
}

/**
 * 1-Click Demo Scenarios (Per specification for instant 30-second stage demos)
 */
export const PRESET_SCENARIOS = [
  {
    id: 'preset_sepsis',
    name: 'Preset 1: Sepsis / Shock',
    tag: 'Critical Red',
    level: 'RED',
    description: 'Septic shock, hypotensive, extreme tachycardia & tachypnea',
    demographics: {
      name: 'Elena Rostova',
      age: 48,
      sex: 'Female',
      chiefComplaint: 'Altered mental status, severe rigors, mottled extremities, suspected septic shock',
      allergies: 'Penicillin, Sulfa',
      medicalHistory: 'Type 2 Diabetes, Splenectomy (2021)',
    },
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
  },
  {
    id: 'preset_pediatric_fever',
    name: 'Preset 2: Pediatric Fever',
    tag: 'Moderate Yellow',
    level: 'YELLOW',
    description: 'High pediatric pyrexia, mild tachycardia, irritable but responsive',
    demographics: {
      name: 'Mateo Morales',
      age: 7,
      sex: 'Male',
      chiefComplaint: 'Persistent high fever x 3 days, dry cough, lethargic, reduced fluid intake',
      allergies: 'No known drug allergies (NKDA)',
      medicalHistory: 'Mild childhood asthma',
    },
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
  },
  {
    id: 'preset_routine_checkup',
    name: 'Preset 3: Routine Checkup',
    tag: 'Stable Green',
    level: 'GREEN',
    description: 'Normal physiological vitals, oriented, ambulatory',
    demographics: {
      name: 'Amara Vance',
      age: 34,
      sex: 'Female',
      chiefComplaint: 'Mild sprained left ankle during field evacuation, fully conscious',
      allergies: 'Latex',
      medicalHistory: 'None significant',
    },
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
  },
  {
    id: 'preset_hypothermia',
    name: 'Preset 4: Severe Trauma / Hypothermia',
    tag: 'Critical Red',
    level: 'RED',
    description: 'Cold exposure & blunt chest trauma, bradypneic, comatose',
    demographics: {
      name: 'David Kalu',
      age: 52,
      sex: 'Male',
      chiefComplaint: 'Found submerged after flash flood; profound hypothermia, blunt chest impact',
      allergies: 'NKDA',
      medicalHistory: 'Hypertension',
    },
    vitals: {
      systolicBP: 74,
      diastolicBP: 46,
      heartRate: 38,
      respRate: 7,
      temperature: 32.8,
      avpu: 'P',
      spo2: 84,
      bloodGlucose: 68,
    },
  },
];
