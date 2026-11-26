import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Calendar,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  buildAttendeeQrPayload,
  buildAttendeeTicketCode,
  CampusEvent,
  EventRegistration,
} from '../config/rbacAndData';
import { downloadFormattedQrPassPng } from './RsvpQrPassCard';

interface StudentEventTicketModalProps {
  registration: EventRegistration;
  event?: CampusEvent;
  isCheckedIn: boolean;
  onClose: () => void;
  onResendEmail: (registrationId: string) => Promise<void>;
}

export const StudentEventTicketModal: React.FC<StudentEventTicketModalProps> = ({
  registration,
  event,
  isCheckedIn,
  onClose,
  onResendEmail,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [resending, setResending] = useState(false);

  const ticketCode =
    registration.ticketCode ||
    buildAttendeeTicketCode(registration.eventId, registration.userId);
  const qrPayload = buildAttendeeQrPayload(
    registration.eventId,
    registration.userId,
    ticketCode
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#070B10',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [qrPayload]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDownloadPass = () => {
    if (!qrDataUrl) return;
    const formattedDate = event
      ? new Date(event.dateISO).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : registration.registeredAt;
    void downloadFormattedQrPassPng({
      qrDataUrl,
      eventTitle: event?.title || registration.eventId,
      venue: event?.venue || 'Paavai Campus',
      eventDate: formattedDate,
      userName: registration.userName,
      registerNumber: registration.registerNumber,
      ticketCode,
    });
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await onResendEmail(registration.id);
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-pass-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E141C] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <QrCode className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0" aria-hidden="true" />
            <h3
              id="entry-pass-title"
              className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate"
            >
              Unique Event Entry Pass
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close entry pass"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#009942] dark:text-[#00EA64] font-semibold">
                {event?.category || 'Campus Event'}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                  isCheckedIn
                    ? 'text-[#009942] dark:text-[#00EA64]'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isCheckedIn ? 'Checked In at Gate' : 'Ready for Gate Scan'}</span>
              </span>
            </div>
            <h4 className="font-mono text-base font-bold text-slate-900 dark:text-white leading-snug">
              {event?.title || registration.eventId}
            </h4>
            {event && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  {new Date(event.dateISO).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  {event.venue}
                </span>
              </div>
            )}
          </div>

          {/* Crisp QR Box */}
          <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-white border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Unique Event Entry QR Pass ${ticketCode}`}
                className="w-52 h-52 object-contain"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs font-mono text-slate-500">
                Generating unique QR...
              </div>
            )}
            <p className="mt-3 font-mono text-sm font-bold tracking-wider text-slate-900 tabular-nums">
              {ticketCode}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 text-center">
              Show this QR code to a logged-in Campus Crew member at the event entrance.
            </p>
          </div>

          {/* Attendee Metadata */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase text-slate-500">Attendee</p>
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                {registration.userName}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-slate-500">Register No.</p>
              <p className="font-mono font-semibold text-slate-900 dark:text-white">
                {registration.registerNumber}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-slate-500">Department</p>
              <p className="text-slate-700 dark:text-slate-300">
                {registration.department} · {registration.year}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-slate-500">QR Email Status</p>
              <p className="font-mono text-slate-700 dark:text-slate-300 capitalize">
                {registration.ticketEmailStatus === 'sent'
                  ? 'Emailed'
                  : registration.ticketEmailStatus === 'failed'
                  ? 'Not sent'
                  : 'Available here'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPass}
              disabled={!qrDataUrl}
              className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download QR PNG</span>
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="py-2.5 px-3 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-[#00EA64] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {resending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{resending ? 'Sending…' : 'Email QR Pass'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
