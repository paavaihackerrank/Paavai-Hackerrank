export interface EventTicketEmailParams {
  attendeeName: string;
  registerNumber: string;
  department: string;
  year: string;
  eventTitle: string;
  eventCategory: string;
  eventDateISO: string;
  venue: string;
  ticketCode: string;
  portalUrl: string;
  qrCid?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEventDate(dateISO: string): string {
  const parsed = new Date(dateISO);
  if (Number.isNaN(parsed.getTime())) return dateISO;
  return parsed.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildEventTicketEmail(params: EventTicketEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const safeName = escapeHtml(params.attendeeName);
  const safeReg = escapeHtml(params.registerNumber);
  const safeDept = escapeHtml(params.department);
  const safeYear = escapeHtml(params.year);
  const safeTitle = escapeHtml(params.eventTitle);
  const safeCategory = escapeHtml(params.eventCategory || 'Campus Event');
  const safeVenue = escapeHtml(params.venue);
  const safeTicket = escapeHtml(params.ticketCode);
  const formattedDate = escapeHtml(formatEventDate(params.eventDateISO));
  const cleanPortal = params.portalUrl.replace(/\/+$/, '');
  const profileUrl = `${cleanPortal}/profile`;
  const safeProfileUrl = escapeHtml(profileUrl);
  const cid = params.qrCid || 'hrcc-ticket-qr';

  const subject = `Your Unique Entry Pass QR — ${params.eventTitle} | HRCC Paavai`;

  const text = [
    `Hello ${params.attendeeName},`,
    '',
    `Your seat is confirmed for "${params.eventTitle}" hosted by HackerRank Campus Crew — Paavai Engineering College.`,
    '',
    'EVENT ENTRY PASS DETAILS',
    '------------------------',
    `Event: ${params.eventTitle} (${params.eventCategory || 'Campus Event'})`,
    `Date & Time: ${formatEventDate(params.eventDateISO)}`,
    `Venue: ${params.venue}`,
    `Attendee: ${params.attendeeName}`,
    `Register Number: ${params.registerNumber}`,
    `Department & Year: ${params.department} · ${params.year}`,
    `Unique Ticket Code: ${params.ticketCode}`,
    '',
    'HOW TO CHECK IN AT THE VENUE:',
    '1. Present the attached unique QR code (or open your Entry Pass QR on your portal Profile page) at the event gate.',
    '2. A logged-in Campus Crew member or Campus Lead will scan your QR code to mark your verified attendance and award +50 leaderboard points.',
    '3. Once checked in, you can claim your verifiable E-Certificate directly from your Profile page.',
    '',
    `View or download your Entry Pass QR anytime: ${profileUrl}`,
    '',
    '— HackerRank Campus Crew, Paavai Engineering College (Autonomous)',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#070B10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background-color:#111722;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#0B111B 0%,#0F1D18 100%);border-bottom:1px solid #1E293B;">
        <div style="font-family:monospace;font-size:11px;letter-spacing:1.6px;color:#00EA64;font-weight:700;text-transform:uppercase;">
          HackerRank Campus Crew · Paavai Engineering College
        </div>
        <h1 style="margin:8px 0 4px 0;font-size:22px;line-height:1.3;color:#FFFFFF;">
          Official Event Entry Pass
        </h1>
        <p style="margin:0;font-size:13px;color:#94A3B8;">
          Present this unique QR code to a Campus Crew member at the event entrance for instant check-in.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:28px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:rgba(0,234,100,0.12);border:1px solid rgba(0,234,100,0.35);font-family:monospace;font-size:11px;font-weight:700;color:#00EA64;text-transform:uppercase;">
          ${safeCategory}
        </div>
        <h2 style="margin:12px 0 8px 0;font-size:20px;line-height:1.35;color:#FFFFFF;">
          ${safeTitle}
        </h2>
        <p style="margin:0 0 22px 0;font-size:13px;color:#CBD5E1;line-height:1.6;">
          <strong>Date &amp; Time:</strong> ${formattedDate}<br/>
          <strong>Venue:</strong> ${safeVenue}
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFFFFF;border-radius:14px;padding:20px;text-align:center;">
          <tr>
            <td style="padding:16px 12px 8px 12px;text-align:center;">
              <img src="cid:${escapeHtml(cid)}" alt="Unique Event Entry QR Code (${safeTicket})" width="220" height="220" style="display:block;margin:0 auto;width:220px;height:220px;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:4px 12px 16px 12px;text-align:center;">
              <div style="font-family:monospace;font-size:16px;font-weight:800;letter-spacing:1.2px;color:#070B10;">
                ${safeTicket}
              </div>
              <div style="margin-top:4px;font-size:11px;color:#475569;">
                Unique single-attendee check-in pass · Do not share with others
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background-color:#0B0F14;border:1px solid #1E293B;border-radius:12px;">
          <tr>
            <td style="padding:14px 18px;font-size:13px;line-height:1.7;color:#CBD5E1;">
              <div><span style="color:#64748B;">Attendee:</span> <strong style="color:#FFFFFF;">${safeName}</strong></div>
              <div><span style="color:#64748B;">Register No:</span> <span style="font-family:monospace;color:#00EA64;">${safeReg}</span></div>
              <div><span style="color:#64748B;">Department &amp; Year:</span> ${safeDept} · ${safeYear}</div>
            </td>
          </tr>
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="${safeProfileUrl}" style="display:inline-block;padding:12px 22px;background-color:#00EA64;color:#070B10;font-weight:700;font-size:13px;text-decoration:none;border-radius:8px;">
            Open Entry Pass in Student Portal
          </a>
        </div>

        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#94A3B8;text-align:center;">
          Once scanned at the gate by Campus Crew, your verified attendance (+50 pts) and E-Certificate claim unlock automatically on your Profile page.
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:16px 28px;background-color:#0B0F14;border-top:1px solid #1E293B;text-align:center;font-size:11px;color:#64748B;">
        HackerRank Campus Crew · Paavai Engineering College (Autonomous), Namakkal<br/>
        You received this automated entry pass because you registered for an official campus event.
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
