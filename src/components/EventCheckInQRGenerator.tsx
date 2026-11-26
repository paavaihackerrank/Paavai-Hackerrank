import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  PauseCircle,
  PlayCircle,
  QrCode,
  ScanLine,
  Trash2,
  Users,
} from 'lucide-react';
import { EventCheckIn, EventCheckInCode, isOnlineEvent } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { printEventNaacReport } from '../lib/eventReportPrint';

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

type CheckInPanelMode = 'gate_scanner' | 'session_qr';

interface ScanOutcome {
  status: 'checked_in' | 'already_checked_in' | 'error';
  message: string;
  checkIn?: EventCheckIn;
}

export const EventCheckInQRGenerator: React.FC = () => {
  const {
    events,
    registrations,
    certificates,
    siteSettings,
    checkInCodes,
    eventCheckIns,
    can,
    generateEventCheckInCode,
    toggleEventCheckInCodeActive,
    deleteEventCheckInCode,
    crewCheckInAttendeeByTicket,
    exportEventCheckInsCSV,
  } = useApp();

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (a.status !== 'approved' && b.status === 'approved') return 1;
        return new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
      }),
    [events]
  );

  const qrEligibleEvents = useMemo(
    () => sortedEvents.filter((ev) => !isOnlineEvent(ev)),
    [sortedEvents]
  );
  const onlineEventsExcludedCount = sortedEvents.length - qrEligibleEvents.length;

  const [panelMode, setPanelMode] = useState<CheckInPanelMode>('gate_scanner');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedCodeId, setSelectedCodeId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<'code' | 'url' | null>(null);
  const [attendeeFilterEventId, setAttendeeFilterEventId] = useState<string>('all');

  // Crew/Lead Gate QR Scanner State
  const [scannerEventId, setScannerEventId] = useState<string>('all');
  const [manualTicketInput, setManualTicketInput] = useState<string>('');
  const [processingScan, setProcessingScan] = useState(false);
  const [scanOutcome, setScanOutcome] = useState<ScanOutcome | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const processingRef = useRef<boolean>(false);

  const supportsBarcodeDetector =
    typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';

  useEffect(() => {
    if (
      (!selectedEventId || !qrEligibleEvents.some((ev) => ev.id === selectedEventId)) &&
      qrEligibleEvents.length > 0
    ) {
      setSelectedEventId(qrEligibleEvents[0].id);
    } else if (qrEligibleEvents.length === 0 && selectedEventId) {
      setSelectedEventId('');
    }
  }, [qrEligibleEvents, selectedEventId]);

  useEffect(() => {
    if (checkInCodes.length === 0) {
      setSelectedCodeId('');
      return;
    }
    if (!selectedCodeId || !checkInCodes.some((c) => c.code === selectedCodeId)) {
      setSelectedCodeId(checkInCodes[0].code);
    }
  }, [checkInCodes, selectedCodeId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (panelMode !== 'gate_scanner' && cameraActive) {
      stopCamera();
    }
  }, [panelMode, cameraActive, stopCamera]);

  const handleProcessTicketScan = useCallback(
    async (rawValue: string) => {
      const cleaned = rawValue.trim();
      if (!cleaned || processingRef.current) return;

      processingRef.current = true;
      setProcessingScan(true);
      try {
        const res = await crewCheckInAttendeeByTicket(
          cleaned,
          scannerEventId === 'all' ? undefined : scannerEventId
        );
        if (!res.ok) {
          setScanOutcome({
            status: 'error',
            message: res.error || 'Could not verify this student QR pass.',
          });
          return;
        }
        if (res.alreadyCheckedIn) {
          setScanOutcome({
            status: 'already_checked_in',
            message: 'Attendee is already checked in for this event.',
            checkIn: res.checkIn,
          });
        } else {
          setScanOutcome({
            status: 'checked_in',
            message: 'Verified & Checked In (+50 Leaderboard Points awarded).',
            checkIn: res.checkIn,
          });
          setManualTicketInput('');
        }
      } finally {
        processingRef.current = false;
        setProcessingScan(false);
      }
    },
    [crewCheckInAttendeeByTicket, scannerEventId]
  );

  const startCamera = async () => {
    setCameraError('');
    if (!supportsBarcodeDetector || !window.BarcodeDetector) {
      setCameraError(
        'Live camera QR scanning is supported in Chrome, Edge, and Android browsers. Use the Ticket Code / Register No. entry box below on this browser.'
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is unavailable on this device or browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      window.requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Autoplay handled by playsInline + muted
        }

        const scanLoop = async () => {
          if (!streamRef.current || !videoRef.current) return;
          if (videoRef.current.readyState >= 2 && !processingRef.current) {
            try {
              const codes = await detector.detect(videoRef.current);
              const firstValue = codes.find((c) => c.rawValue)?.rawValue?.trim();
              if (firstValue) {
                const now = Date.now();
                const isSameRecent =
                  lastScannedRef.current.value === firstValue &&
                  now - lastScannedRef.current.at < 3500;
                if (!isSameRecent) {
                  lastScannedRef.current = { value: firstValue, at: now };
                  await handleProcessTicketScan(firstValue);
                }
              }
            } catch {
              // Ignore transient frame decode errors
            }
          }
          rafRef.current = window.requestAnimationFrame(scanLoop);
        };

        rafRef.current = window.requestAnimationFrame(scanLoop);
      });
    } catch (err) {
      stopCamera();
      setCameraError(
        err instanceof Error
          ? `Camera access denied or unavailable: ${err.message}`
          : 'Could not open device camera for QR scanning.'
      );
    }
  };

  const handleManualScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleProcessTicketScan(manualTicketInput);
  };

  const activeCodeDoc: EventCheckInCode | undefined = useMemo(
    () => checkInCodes.find((c) => c.code === selectedCodeId),
    [checkInCodes, selectedCodeId]
  );

  const scanUrl = useMemo(() => {
    if (!activeCodeDoc) return '';
    return `${window.location.origin}/checkin?code=${encodeURIComponent(activeCodeDoc.code)}`;
  }, [activeCodeDoc]);

  useEffect(() => {
    let cancelled = false;
    if (!scanUrl) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(scanUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0B0F14',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [scanUrl]);

  const filteredCheckIns = useMemo(() => {
    if (attendeeFilterEventId === 'all') return eventCheckIns;
    return eventCheckIns.filter((c) => c.eventId === attendeeFilterEventId);
  }, [eventCheckIns, attendeeFilterEventId]);

  const reportTargetEvent = useMemo(() => {
    if (attendeeFilterEventId !== 'all') {
      return events.find((e) => e.id === attendeeFilterEventId);
    }
    if (scannerEventId !== 'all') {
      return events.find((e) => e.id === scannerEventId);
    }
    return sortedEvents[0];
  }, [attendeeFilterEventId, scannerEventId, events, sortedEvents]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    setGenerating(true);
    setGenError('');
    const res = await generateEventCheckInCode(selectedEventId);
    setGenerating(false);
    if (!res.ok || !res.codeDoc) {
      setGenError(res.error || 'Could not generate event check-in QR code.');
      return;
    }
    setSelectedCodeId(res.codeDoc.code);
  };

  const handleCopy = async (kind: 'code' | 'url', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(kind);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl || !activeCodeDoc) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `hrcc-checkin-${activeCodeDoc.code}.png`;
    link.click();
  };

  const handlePrintNaacReport = () => {
    if (!reportTargetEvent) return;
    printEventNaacReport({
      event: reportTargetEvent,
      registrations,
      checkIns: eventCheckIns,
      certificates,
      siteSettings,
    });
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelMode('gate_scanner')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors ${
              panelMode === 'gate_scanner'
                ? 'bg-[#00EA64] text-[#0B0F14]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            }`}
          >
            <ScanLine className="w-4 h-4" aria-hidden="true" />
            <span>Crew Gate Scanner (Scan Student QRs)</span>
          </button>
          <button
            type="button"
            onClick={() => setPanelMode('session_qr')}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors ${
              panelMode === 'session_qr'
                ? 'bg-[#00EA64] text-[#0B0F14]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            }`}
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>Event Session QR (Self Check-In)</span>
          </button>
        </div>

        {reportTargetEvent && (
          <button
            type="button"
            onClick={handlePrintNaacReport}
            className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] hover:text-[#009942] dark:hover:text-[#00EA64] inline-flex items-center gap-1.5 transition-colors"
            title={`Print NAAC / IQAC report for ${reportTargetEvent.title}`}
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>NAAC / IQAC Report</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Crew Gate Scanner OR Event Session QR Generator */}
        <div className="lg:col-span-5 space-y-6">
          {panelMode === 'gate_scanner' ? (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
              <div className="space-y-1">
                <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                  Authenticated Crew Gate Check-In
                </p>
                <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                  Scan Student Entry Pass QR
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Scan the unique QR code emailed to registered students (or displayed on their
                  Profile). Verified scans instantly record attendance and award +50 leaderboard
                  points.
                </p>
              </div>

              {/* Optional Target Event Lock */}
              <div>
                <label
                  htmlFor="crew-scanner-event-select"
                  className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Target Event Verification Scope
                </label>
                <select
                  id="crew-scanner-event-select"
                  value={scannerEventId}
                  onChange={(e) => {
                    setScannerEventId(e.target.value);
                    setAttendeeFilterEventId(e.target.value);
                  }}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="all">Any In-Person / Hybrid Event (Auto-detect from QR)</option>
                  {qrEligibleEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
                {onlineEventsExcludedCount > 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {onlineEventsExcludedCount} online event
                    {onlineEventsExcludedCount === 1 ? ' is' : 's are'} excluded — online events do
                    not use QR check-in.
                  </p>
                )}
              </div>

              {/* Camera Controls & Live Viewfinder */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" aria-hidden="true" />
                      <span>Start Camera QR Scanner</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex-1 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <CameraOff className="w-4 h-4" aria-hidden="true" />
                      <span>Stop Camera</span>
                    </button>
                  )}
                </div>

                {cameraError && (
                  <div className="p-3 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                    {cameraError}
                  </div>
                )}

                {cameraActive && (
                  <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#00EA64]/60 aspect-[4/3]">
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 rounded-xl border-2 border-[#00EA64] shadow-[0_0_0_9999px_rgba(7,11,16,0.45)]" />
                    </div>
                    <div className="absolute bottom-2 inset-x-2 text-center">
                      <span className="inline-block px-2.5 py-1 rounded bg-black/75 text-[11px] font-mono text-[#00EA64]">
                        {processingScan ? 'Verifying pass...' : 'Align student Entry Pass QR inside frame'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Ticket Code / Register No. Lookup */}
              <form
                onSubmit={handleManualScanSubmit}
                className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <label
                  htmlFor="manual-ticket-input"
                  className="block text-xs font-mono text-slate-500 dark:text-slate-400"
                >
                  Manual Entry (Ticket Code, Register No., or Email)
                </label>
                <div className="flex gap-2">
                  <input
                    id="manual-ticket-input"
                    type="text"
                    value={manualTicketInput}
                    onChange={(e) => setManualTicketInput(e.target.value)}
                    placeholder="PASS-... or 622123104001"
                    className="flex-1 h-10 px-3 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={processingScan || !manualTicketInput.trim()}
                    className="h-10 px-4 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {processingScan ? 'Checking…' : 'Verify & Check In'}
                  </button>
                </div>
              </form>

              {/* Instant Verification Receipt Card */}
              {scanOutcome && (
                <div
                  role="status"
                  className={`p-4 rounded-xl border space-y-2 ${
                    scanOutcome.status === 'checked_in'
                      ? 'bg-[#00EA64]/10 border-[#00EA64]/45 text-slate-900 dark:text-white'
                      : scanOutcome.status === 'already_checked_in'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-950 dark:text-amber-100'
                      : 'bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                    {scanOutcome.status === 'checked_in' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {scanOutcome.status === 'checked_in'
                        ? 'Checked In Successfully'
                        : scanOutcome.status === 'already_checked_in'
                        ? 'Already Checked In'
                        : 'Pass Rejected'}
                    </span>
                  </div>
                  <p className="text-xs opacity-90">{scanOutcome.message}</p>
                  {scanOutcome.checkIn && (
                    <div className="pt-2 mt-1 border-t border-current/15 grid grid-cols-2 gap-1.5 text-xs">
                      <div>
                        <span className="block font-mono text-[10px] opacity-65">Student</span>
                        <span className="font-semibold">{scanOutcome.checkIn.userName}</span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] opacity-65">Register No.</span>
                        <span className="font-mono font-semibold">
                          {scanOutcome.checkIn.registerNumber}
                        </span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] opacity-65">Dept &amp; Year</span>
                        <span>
                          {scanOutcome.checkIn.department} · {scanOutcome.checkIn.year}
                        </span>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] opacity-65">Event</span>
                        <span className="truncate block">{scanOutcome.checkIn.eventTitle}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <form
                onSubmit={handleGenerate}
                className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-4"
              >
                <div className="space-y-1">
                  <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
                    Attendance Verification · Unique QR Session
                  </p>
                  <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    Generate Event Check-In QR
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Creates a unique check-in event ID in Firestore and encodes a scannable QR link
                    that lets students self-check-in at the venue entrance.
                  </p>
                </div>

                {genError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
                  >
                    {genError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="qr-event-select"
                    className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Target Campus Event
                  </label>
                  <select
                    id="qr-event-select"
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  >
                    {qrEligibleEvents.length === 0 ? (
                      <option value="">No in-person or hybrid events available</option>
                    ) : (
                      qrEligibleEvents.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title} ({ev.status})
                        </option>
                      ))
                    )}
                  </select>
                  {onlineEventsExcludedCount > 0 && (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Online events are hidden here because QR check-in is disabled for online
                      sessions. Toggle optional participant attendance from the Events tab.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={generating || qrEligibleEvents.length === 0}
                  className="w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  <span>{generating ? 'Generating Unique QR...' : 'Generate Unique Event QR'}</span>
                </button>
              </form>

              {/* Active QR Pass Card */}
              {activeCodeDoc ? (
                <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {activeCodeDoc.isActive ? 'Active Check-In Session' : 'Paused Check-In Session'}
                      </p>
                      <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white truncate">
                        {activeCodeDoc.eventTitle}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {activeCodeDoc.venue}
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold whitespace-nowrap shrink-0 ${
                        activeCodeDoc.isActive
                          ? 'text-[#009942] dark:text-[#00EA64]'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {activeCodeDoc.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-white border border-slate-200">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Check-in QR code for ${activeCodeDoc.eventTitle} (${activeCodeDoc.code})`}
                        className="w-56 h-56 object-contain"
                      />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-xs font-mono text-slate-500">
                        Rendering QR...
                      </div>
                    )}
                    <p className="mt-3 font-mono text-sm font-bold tracking-wider text-slate-900 tabular-nums">
                      {activeCodeDoc.code}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopy('code', activeCodeDoc.code)}
                      className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'code' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                          <span>ID Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy Event ID</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy('url', scanUrl)}
                      className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'url' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Copy Scan URL</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQR}
                      disabled={!qrDataUrl}
                      className="py-2 px-3 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Download PNG</span>
                    </button>

                    <Link
                      to={`/checkin?code=${encodeURIComponent(activeCodeDoc.code)}`}
                      className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Open Check-In</span>
                    </Link>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleEventCheckInCodeActive(activeCodeDoc.code, !activeCodeDoc.isActive)
                      }
                      className="py-1.5 px-3 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {activeCodeDoc.isActive ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                          <span>Pause QR</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                          <span>Resume QR</span>
                        </>
                      )}
                    </button>

                    {can('canEditDeleteAnyEvent') && (
                      <button
                        type="button"
                        onClick={() => deleteEventCheckInCode(activeCodeDoc.code)}
                        className="py-1.5 px-3 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-500/50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Delete Code</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-center space-y-2">
                  <QrCode className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
                  <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No Check-In QR Codes Yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select an event above and generate a unique check-in QR code to display at the
                    venue entrance.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Live Firestore Attendee Check-Ins + (in Session QR mode) Generated Codes */}
        <div className="lg:col-span-7 space-y-6">
          {panelMode === 'session_qr' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    Generated Check-In Codes ({checkInCodes.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select a session to preview, copy, or pause its unique QR code.
                  </p>
                </div>
              </div>

              {checkInCodes.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 dark:text-slate-400">
                  No check-in QR sessions created yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto">
                  {checkInCodes.map((item) => {
                    const countForCode = eventCheckIns.filter(
                      (c) => c.checkInCode === item.code
                    ).length;
                    const isSelected = item.code === selectedCodeId;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setSelectedCodeId(item.code)}
                        className={`w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 transition-colors ${
                          isSelected
                            ? 'bg-[#00EA64]/8 dark:bg-[#00EA64]/10'
                            : 'hover:bg-slate-50 dark:hover:bg-[#0B0F14]/50'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.code} · {item.eventTitle}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Created by {item.createdByName} ·{' '}
                            <span className="tabular-nums">
                              {new Date(item.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                            {countForCode} scanned
                          </p>
                          <p
                            className={`font-mono text-[11px] ${
                              item.isActive
                                ? 'text-[#009942] dark:text-[#00EA64]'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.isActive ? 'Active' : 'Paused'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Live Scanned Attendee Details Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                  <span>Verified Attendees ({filteredCheckIns.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time attendance log from Gate QR scans, Event Session QR check-ins, and
                  admin-enabled Online Attendance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter attendees by event"
                  value={attendeeFilterEventId}
                  onChange={(e) => setAttendeeFilterEventId(e.target.value)}
                  className="h-9 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="all">All Events</option>
                  {sortedEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>

                {can('canExportRegistrations') && (
                  <button
                    type="button"
                    onClick={() =>
                      exportEventCheckInsCSV(
                        attendeeFilterEventId === 'all' ? undefined : attendeeFilterEventId
                      )
                    }
                    className="h-9 px-3 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Export CSV</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] text-xs font-mono text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Attendee</th>
                    <th className="py-3 px-4">Register No.</th>
                    <th className="py-3 px-4">Dept &amp; Year</th>
                    <th className="py-3 px-4">Event / Pass Code</th>
                    <th className="py-3 px-4 text-right">Checked In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCheckIns.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        No attendees have checked in for this filter yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCheckIns.map((chk) => (
                      <tr key={chk.id}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {chk.userName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {chk.userEmail}
                            {chk.phone ? ` · ${chk.phone}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{chk.registerNumber}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {chk.department} · {chk.year}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {chk.eventTitle}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {chk.checkInCode === 'ONLINE-ATTENDANCE'
                              ? 'Online Attendance'
                              : chk.checkInCode}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {new Date(chk.checkedInAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
