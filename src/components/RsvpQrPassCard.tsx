import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import {
  CampusEvent,
  EventRegistration,
  buildAttendeeQrPayload,
  buildAttendeeTicketCode,
} from '../config/rbacAndData';

export interface RsvpQrPassCardProps {
  registration: EventRegistration;
  event: CampusEvent;
  isCheckedIn: boolean;
  checkedInAt?: string;
  isPast: boolean;
  resendingTicket: boolean;
  cancelingRsvp: boolean;
  onEnlarge: () => void;
  onResendEmail: () => Promise<void>;
  onCancelRsvp: () => Promise<void>;
}

/**
 * Renders a crisp printable Entry Pass PNG (white card with event details,
 * scannable QR code, attendee name, register number, and pass code) onto an
 * offscreen canvas, falling back to the raw QR data URL if needed.
 */
export async function downloadFormattedQrPassPng(params: {
  qrDataUrl: string;
  eventTitle: string;
  venue: string;
  eventDate: string;
  userName: string;
  registerNumber: string;
  ticketCode: string;
}): Promise<void> {
  const { qrDataUrl, eventTitle, venue, eventDate, userName, registerNumber, ticketCode } = params;
  if (!qrDataUrl) return;

  const triggerDownload = (href: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = `HRCC-Paavai-RSVP-Pass-${ticketCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = qrDataUrl;
    });

    const width = 720;
    const height = 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      triggerDownload(qrDataUrl);
      return;
    }

    // Card background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top header band
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, width, 152);

    ctx.fillStyle = '#00EA64';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('HACKERRANK CAMPUS CREW · PAAVAI', 44, 52);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    const clippedTitle = eventTitle.length > 42 ? `${eventTitle.slice(0, 41)}…` : eventTitle;
    ctx.fillText(clippedTitle, 44, 96);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px monospace';
    const metaLine = `${eventDate} · ${venue}`;
    const clippedMeta = metaLine.length > 54 ? `${metaLine.slice(0, 53)}…` : metaLine;
    ctx.fillText(clippedMeta, 44, 130);

    // QR Code centered
    const qrSize = 440;
    const qrX = Math.round((width - qrSize) / 2);
    const qrY = 196;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.strokeRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

    // Pass Code
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ticketCode, width / 2, 706);

    // Divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(44, 742);
    ctx.lineTo(width - 44, 742);
    ctx.stroke();

    // Attendee metadata
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '16px monospace';
    ctx.fillText('ATTENDEE', 44, 784);
    ctx.fillText('REGISTER NO.', 440, 784);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px sans-serif';
    const clippedName = userName.length > 26 ? `${userName.slice(0, 25)}…` : userName;
    ctx.fillText(clippedName, 44, 818);

    ctx.font = 'bold 24px monospace';
    ctx.fillText(registerNumber || '—', 440, 818);

    // Footer instruction
    ctx.fillStyle = '#475569';
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Present this unique QR pass to Campus Crew at the event entrance for check-in.',
      width / 2,
      896
    );

    triggerDownload(canvas.toDataURL('image/png'));
  } catch {
    triggerDownload(qrDataUrl);
  }
}

export const RsvpQrPassCard: React.FC<RsvpQrPassCardProps> = ({
  registration,
  event,
  isCheckedIn,
  checkedInAt,
  isPast,
  resendingTicket,
  cancelingRsvp,
  onEnlarge,
  onResendEmail,
  onCancelRsvp,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const ticketCode =
    registration.ticketCode || buildAttendeeTicketCode(registration.eventId, registration.userId);
  const qrPayload = buildAttendeeQrPayload(registration.eventId, registration.userId, ticketCode);

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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ticketCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const formattedEventDate = new Date(event.dateISO).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleDownload = () => {
    void downloadFormattedQrPassPng({
      qrDataUrl,
      eventTitle: event.title,
      venue: event.venue,
      eventDate: formattedEventDate,
      userName: registration.userName,
      registerNumber: registration.registerNumber,
      ticketCode,
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Status Header */}
      <div className="flex items-center justify-between gap-2 text-xs font-mono">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#009942] dark:text-[#00EA64]">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{isCheckedIn ? 'Attendance Verified' : 'RSVP Confirmed'}</span>
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {isCheckedIn && checkedInAt
            ? new Date(checkedInAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Ready for Gate Scan'}
        </span>
      </div>

      {/* Inline High-Contrast Unique QR Code Pass */}
      <div className="rounded-lg bg-white border border-slate-200 p-4 flex flex-col items-center text-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`Unique check-in QR code for ${registration.userName} (${ticketCode})`}
            className="w-44 h-44 object-contain"
          />
        ) : (
          <div className="w-44 h-44 flex items-center justify-center text-xs font-mono text-slate-500">
            Generating unique QR…
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          <span className="font-mono text-xs font-bold tracking-wider text-slate-900 tabular-nums">
            {ticketCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copy unique pass code"
            title="Copy pass code"
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-[#009942]" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        <p className="mt-1 text-[11px] font-mono text-slate-600 truncate max-w-full">
          {registration.userName} · {registration.registerNumber}
        </p>
        <p className="mt-1 text-[11px] text-slate-500 leading-snug">
          Scan at {event.venue} with Campus Crew for instant event check-in.
        </p>
      </div>

      {/* Primary Action: Download Printable Pass PNG */}
      <button
        type="button"
        disabled={!qrDataUrl}
        onClick={handleDownload}
        className="w-full py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span>Download QR Pass PNG</span>
      </button>

      {/* Secondary Actions: Enlarge & Email QR */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEnlarge}
          className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Enlarge QR</span>
        </button>

        <button
          type="button"
          disabled={resendingTicket}
          onClick={onResendEmail}
          className="py-2 px-3 rounded-lg text-xs font-mono border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
        >
          {resendingTicket ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{resendingTicket ? 'Sending…' : 'Email QR'}</span>
        </button>
      </div>

      {/* Cancel RSVP or Profile Link */}
      {!isPast && !isCheckedIn ? (
        <button
          type="button"
          disabled={cancelingRsvp}
          onClick={onCancelRsvp}
          className="w-full py-2 px-3 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-500/40 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {cancelingRsvp ? 'Updating RSVP…' : 'Cancel RSVP'}
        </button>
      ) : (
        <Link
          to="/profile"
          className="block w-full py-2 px-3 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00EA64] text-center whitespace-nowrap transition-colors"
        >
          View All Passes on My Profile
        </Link>
      )}
    </div>
  );
};

export default RsvpQrPassCard;
