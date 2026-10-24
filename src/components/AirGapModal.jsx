import React, { useState, useRef } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { compressPatientData } from '../utils/transfer';
import { recordOpticalTransfer } from '../db';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Printer, 
  ShieldCheck, 
  Radio, 
  Cpu, 
  Zap, 
  AlertTriangle,
  QrCode
} from 'lucide-react';

export default function AirGapModal({ patient, onClose, onTransferSuccess }) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  if (!patient) return null;

  const compressedInfo = compressPatientData(patient);
  const { token, rawBytes, compressedBytes, compressionRatio } = compressedInfo;

  const mews = patient.mews || { score: 0, level: 'GREEN' };
  const level = patient.level || mews.level;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      if (patient.id) {
        await recordOpticalTransfer(patient.id);
      }
      if (onTransferSuccess) {
        onTransferSuccess('Air-Gap optical token copied to clipboard');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadQR = () => {
    try {
      const canvas = document.getElementById('airgap-qr-canvas');
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `AURA-TRIAGE-${patient.triageId || 'TOKEN'}-${patient.level}.png`;
        a.click();
      }
    } catch (e) {
      console.error('QR download error', e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isRed = level === 'RED';
  const isYellow = level === 'YELLOW';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className={`relative w-full max-w-2xl bg-slate-900 border rounded-2xl shadow-2xl overflow-hidden my-auto ${
        isRed 
          ? 'border-rose-500/50 shadow-rose-950/40' 
          : isYellow 
          ? 'border-amber-500/40 shadow-amber-950/30' 
          : 'border-emerald-500/30 shadow-emerald-950/20'
      }`}>
        
        {/* Header Bar */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${
          isRed 
            ? 'bg-rose-950/40 border-rose-900/60' 
            : isYellow 
            ? 'bg-amber-950/30 border-amber-900/50' 
            : 'bg-slate-800/60 border-slate-700/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isRed ? 'bg-rose-500/20 text-rose-400' : isYellow ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  OPTICAL AIR-GAP TELEMETRY TOKEN
                </h3>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full border ${
                  isRed 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' 
                    : isYellow 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  CODE {level}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Zero-RF Optical Compression // Camera Viewfinder Handshake
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            
            {/* Left QR Section */}
            <div className="md:col-span-6 flex flex-col items-center">
              <div className="p-4 bg-white rounded-xl shadow-lg border-2 border-slate-700 relative group">
                <QRCodeSVG
                  value={token}
                  size={220}
                  level="M"
                  includeMargin={true}
                  className="rounded-lg"
                />
                {/* Hidden canvas for PNG export */}
                <div className="hidden">
                  <QRCodeCanvas
                    id="airgap-qr-canvas"
                    value={token}
                    size={400}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>

              {/* Compression stats banner */}
              <div className="mt-4 w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    LZ-String
                  </span>
                  <span className="text-emerald-400 font-bold">
                    -{compressionRatio}% Compressed
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Raw: {rawBytes}B</span>
                  <span>→</span>
                  <span className="text-cyan-300 font-semibold">QR: {compressedBytes}B</span>
                </div>
              </div>
            </div>

            {/* Right Summary Section */}
            <div className="md:col-span-6 space-y-3.5">
              {/* Patient Badge */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {patient.name || 'Anonymous Patient'}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      {patient.age}y • {patient.sex} • {patient.triageId}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-mono">MEWS SCORE</span>
                    <p className={`text-xl font-extrabold font-mono ${
                      isRed ? 'text-rose-400' : isYellow ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {mews.score} <span className="text-xs font-normal text-slate-400">/ 14</span>
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="bg-slate-900/80 p-1.5 rounded">
                    <span className="text-[10px] text-slate-500 block">BP</span>
                    <span className="font-bold text-slate-200">
                      {patient.vitals?.systolicBP}/{patient.vitals?.diastolicBP || '–'}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-1.5 rounded">
                    <span className="text-[10px] text-slate-500 block">HR</span>
                    <span className="font-bold text-slate-200">{patient.vitals?.heartRate}</span>
                  </div>
                  <div className="bg-slate-900/80 p-1.5 rounded">
                    <span className="text-[10px] text-slate-500 block">RR</span>
                    <span className="font-bold text-slate-200">{patient.vitals?.respRate}</span>
                  </div>
                  <div className="bg-slate-900/80 p-1.5 rounded">
                    <span className="text-[10px] text-slate-500 block">TEMP</span>
                    <span className="font-bold text-slate-200">{patient.vitals?.temperature}°</span>
                  </div>
                </div>

                {patient.chiefComplaint && (
                  <div className="mt-2 text-xs text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-800/50">
                    <span className="text-[10px] font-mono text-slate-500 block">CHIEF COMPLAINT</span>
                    <p className="line-clamp-2">{patient.chiefComplaint}</p>
                  </div>
                )}
              </div>

              {/* Protocol Note */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  OPTICAL PROTOCOL VERIFIED
                </div>
                <p className="text-[11px] leading-relaxed">
                  Hold this QR code directly in front of the receiving hospital / medevac tablet camera. No WiFi, Bluetooth, or cellular signal required.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xs font-semibold rounded-lg transition border border-slate-700 shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Token Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Token</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={downloadQR}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xs font-semibold rounded-lg transition border border-slate-700 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono rounded-lg transition border border-slate-800"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Triage Wristband / Field Card</span>
              </button>

            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
          <span>TOKEN ID: {patient.patientUuid}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            READY FOR AIR-GAP INGESTION
          </span>
        </div>

      </div>
    </div>
  );
}
