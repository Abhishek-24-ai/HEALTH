import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { decompressPatientData } from '../utils/transfer';
import { addPatientRecord } from '../db';
import { 
  playScanSuccessSound, 
  playRedAlertSound, 
  playYellowAlertSound, 
  playGreenAlertSound 
} from '../utils/audioAlert';
import { 
  Camera, 
  CameraOff, 
  Scan, 
  Clipboard, 
  CheckCircle, 
  AlertTriangle, 
  UserPlus, 
  Cpu, 
  RefreshCw, 
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

export default function QRScanner({ onPatientAdmitted, onShowToast }) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [scannedPatient, setScannedPatient] = useState(null);
  const [decodingError, setDecodingError] = useState(null);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [autoAdmit, setAutoAdmit] = useState(true);

  const scannerRef = useRef(null);
  const qrRegionId = 'aura-qr-viewfinder';

  // Discover available cameras
  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer environment / rear camera if available
          const backCam = devices.find((d) => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') || 
            d.label.toLowerCase().includes('rear')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError('No video input hardware detected. Use direct token ingestion below.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.warn('Camera discovery error:', err);
        setCameraError('Camera access unavailable (check browser permissions). Use manual token ingest.');
      });

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  const startScanner = async (cameraId) => {
    setCameraError(null);
    setDecodingError(null);

    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(qrRegionId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraId || { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleTokenDecoded(decodedText);
        },
        () => {
          // Frame error (no QR detected yet) - silent
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      setCameraError('Failed to initialize optical sensor: ' + (err.message || err));
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleToggleScanner = () => {
    if (isScanning) {
      stopScanner();
    } else {
      startScanner(selectedCameraId);
    }
  };

  const handleTokenDecoded = async (tokenString) => {
    try {
      setDecodingError(null);
      const patient = decompressPatientData(tokenString);

      // Play audio feedback
      playScanSuccessSound();
      if (patient.level === 'RED') {
        setTimeout(() => playRedAlertSound(), 350);
      } else if (patient.level === 'YELLOW') {
        setTimeout(() => playYellowAlertSound(), 350);
      } else {
        setTimeout(() => playGreenAlertSound(), 350);
      }

      setScannedPatient(patient);

      // Pause scanner while patient card is presented
      stopScanner();

      if (autoAdmit) {
        await admitPatient(patient);
      }
    } catch (err) {
      console.error('Decoding failed:', err);
      setDecodingError('Optical decompression failed: ' + err.message);
    }
  };

  const handleManualIngest = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleTokenDecoded(manualToken.trim());
  };

  const admitPatient = async (patientToAdmit = scannedPatient) => {
    if (!patientToAdmit || isAdmitting) return;
    setIsAdmitting(true);

    try {
      const record = await addPatientRecord({
        ...patientToAdmit,
        synced: 0, // Unsynced in hospital queue, ready for district replication
        admittedVia: 'Optical Air-Gap',
      });

      if (onPatientAdmitted) {
        onPatientAdmitted(record);
      }

      if (onShowToast) {
        onShowToast(`Admitted: ${record.name} (${record.level}) to Hospital Queue`);
      }
    } catch (err) {
      alert('Error admitting patient: ' + err.message);
    } finally {
      setIsAdmitting(false);
    }
  };

  const resetCapture = () => {
    setScannedPatient(null);
    setManualToken('');
    setDecodingError(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Protocol Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Optical Air-Gap Telemetry Receiver
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Direct Camera Screen-to-Screen Handshake // Zero-RF Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdmit}
              onChange={(e) => setAutoAdmit(e.target.checked)}
              className="accent-cyan-400 rounded"
            />
            <span>Auto-Admit to Central Queue</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Camera Viewfinder & Direct Ingest (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm">
            
            {/* Viewfinder Controls */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                <span className="text-slate-300 font-semibold">
                  {isScanning ? 'OPTICAL SCANNER ACTIVE' : 'CAMERA STANDBY'}
                </span>
              </div>

              {cameras.length > 1 && (
                <select
                  value={selectedCameraId || ''}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (isScanning) {
                      startScanner(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs font-mono focus:outline-none"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${c.id.substring(0, 5)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Video Viewfinder Container */}
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden min-h-[300px] flex items-center justify-center">
              
              <div id={qrRegionId} className="w-full max-w-sm rounded-lg overflow-hidden" />

              {/* Tactical Viewfinder Overlay when scanning */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-cyan-400/60 rounded-xl relative">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-300" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-300" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-300" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-300" />
                    
                    {/* Animated Scanning Laser */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scanline shadow-[0_0_8px_#38bdf8]" />
                  </div>
                </div>
              )}

              {/* Idle / Inactive Overlay */}
              {!isScanning && (
                <div className="p-8 text-center space-y-3 z-10">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">
                      Optical Capture Offline
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                      Activate camera to scan air-gapped QR wristbands or use the direct token ingestion below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleScanner}
                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold rounded-lg transition shadow-lg shadow-cyan-950/40 inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    INITIALIZE CAMERA SCANNER
                  </button>
                </div>
              )}
            </div>

            {/* Toggle button when camera is on */}
            {isScanning && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={stopScanner}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition flex items-center gap-2"
                >
                  <CameraOff className="w-4 h-4" />
                  Pause Optical Camera
                </button>
              </div>
            )}

            {/* Camera error notification if any */}
            {cameraError && (
              <div className="mt-3 p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>

          {/* Direct String Ingest Fallback */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clipboard className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                Direct Optical Token Fallback (Clipboard / Sim Ingest)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mb-3">
              Paste raw compressed AURA-1 payload if operating on a camera-restricted device:
            </p>

            <form onSubmit={handleManualIngest} className="space-y-3">
              <textarea
                rows={2}
                placeholder="Paste AURA1:xxxx string here..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-cyan-300 font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setManualToken(text);
                    } catch (e) {
                      alert('Clipboard access denied');
                    }
                  }}
                  className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Paste From Clipboard
                </button>

                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-lg transition border border-slate-700 flex items-center gap-2"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Decode & Ingest
                </button>
              </div>
            </form>

            {decodingError && (
              <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 text-xs font-mono">
                {decodingError}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Decoded Patient Preview & Action Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {scannedPatient ? (
            <div className={`bg-slate-900 border rounded-2xl p-5 shadow-2xl backdrop-blur-md transition-all ${
              scannedPatient.level === 'RED'
                ? 'border-rose-500/60 triage-glow-red'
                : scannedPatient.level === 'YELLOW'
                ? 'border-amber-500/50 triage-glow-yellow'
                : 'border-emerald-500/40 triage-glow-green'
            }`}>
              
              {/* Badge & Triage Level */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    OPTICAL HANDSHAKE VERIFIED
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded-full border ${
                  scannedPatient.level === 'RED'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : scannedPatient.level === 'YELLOW'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  CODE {scannedPatient.level}
                </span>
              </div>

              {/* Patient Basic Info */}
              <div className="mt-4">
                <h3 className="text-lg font-bold text-white">
                  {scannedPatient.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {scannedPatient.age} yrs • {scannedPatient.sex} • {scannedPatient.patientUuid}
                </p>
                <div className="mt-1 text-[11px] font-mono text-cyan-400">
                  Origin: {scannedPatient.originUnit}
                </div>
              </div>

              {/* MEWS Score Highlight */}
              <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">
                    MODIFIED EARLY WARNING SCORE
                  </span>
                  <span className={`text-2xl font-black font-mono ${
                    scannedPatient.level === 'RED'
                      ? 'text-rose-400'
                      : scannedPatient.level === 'YELLOW'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    MEWS: {scannedPatient.mews?.score}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400 text-right">
                  Target: {scannedPatient.mews?.responseTime || '< 15 min'}
                </span>
              </div>

              {/* Core Vitals Grid */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">BP</span>
                  <span className="font-bold text-slate-200">
                    {scannedPatient.vitals?.systolicBP}/{scannedPatient.vitals?.diastolicBP}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">HR</span>
                  <span className="font-bold text-slate-200">{scannedPatient.vitals?.heartRate}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">RR</span>
                  <span className="font-bold text-slate-200">{scannedPatient.vitals?.respRate}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">TEMP</span>
                  <span className="font-bold text-slate-200">{scannedPatient.vitals?.temperature}°</span>
                </div>
              </div>

              {/* Chief Complaint */}
              {scannedPatient.chiefComplaint && (
                <div className="mt-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">
                    CHIEF COMPLAINT & SYMPTOMS
                  </span>
                  <p className="text-slate-300 mt-1">
                    {scannedPatient.chiefComplaint}
                  </p>
                </div>
              )}

              {/* Protocol Recommendation */}
              <div className="mt-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs">
                <span className="text-[10px] font-mono text-amber-400 block font-bold uppercase">
                  RECOMMENDED RESUSCITATION ACTIONS
                </span>
                <p className="text-slate-300 mt-1">
                  {scannedPatient.mews?.clinicalAction}
                </p>
              </div>

              {/* Admitted Confirmation or Action Buttons */}
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => admitPatient(scannedPatient)}
                  disabled={isAdmitting}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                    scannedPatient.level === 'RED'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : scannedPatient.level === 'YELLOW'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>CONFIRM ADMISSION TO QUEUE</span>
                </button>

                <button
                  type="button"
                  onClick={resetCapture}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-mono rounded-lg transition border border-slate-800"
                >
                  Scan Next Patient
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4 backdrop-blur-sm">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                <Scan className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-mono uppercase">
                  Awaiting Optical Telemetry
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Point camera at an AURA-TRIAGE patient QR code or paste the token to instantly unpack clinical telemetry.
                </p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-400 text-left space-y-1">
                <div className="text-cyan-400 font-bold">AIR-GAP SECURITY GUARANTEE:</div>
                <div>• Zero WiFi / Bluetooth packets emitted</div>
                <div>• Optical photons only</div>
                <div>• Immunity to radio blackouts and jamming</div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
