import {
  CampusEvent,
  EventCertificate,
  EventCheckIn,
  EventRegistration,
  SiteSettings,
} from '../config/rbacAndData';

export interface NaacEventReportOptions {
  event: CampusEvent;
  registrations: EventRegistration[];
  checkIns: EventCheckIn[];
  certificates: EventCertificate[];
  siteSettings: SiteSettings;
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateLong(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr || '—';
  return parsed.toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeShort(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr || '—';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generates and prints an official NAAC / IQAC Activity & Verified Attendance Report
 * using an isolated hidden iframe (no window.open or window.alert).
 */
export function printEventNaacReport(options: NaacEventReportOptions): boolean {
  const { event, registrations, checkIns, certificates, siteSettings } = options;

  const eventRegs = registrations.filter((r) => r.eventId === event.id);
  const eventCheckIns = [...checkIns]
    .filter((c) => c.eventId === event.id)
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const eventCerts = certificates.filter((c) => c.eventId === event.id);
  const awardWinners = eventCerts.filter((c) => c.awardType !== 'Participation');

  const attendanceRate =
    eventRegs.length > 0
      ? `${Math.min(100, Math.round((eventCheckIns.length / eventRegs.length) * 100))}%`
      : eventCheckIns.length > 0
      ? '100%'
      : '0%';

  // Department breakdown of verified attendees
  const deptCounts = new Map<string, number>();
  eventCheckIns.forEach((chk) => {
    const key = chk.department || 'Other';
    deptCounts.set(key, (deptCounts.get(key) || 0) + 1);
  });
  const deptBreakdownEntries = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const winnersHtml =
    awardWinners.length > 0
      ? `
      <section class="section">
        <h2>3. Award Winners &amp; Recognitions (${awardWinners.length})</h2>
        <table>
          <thead>
            <tr>
              <th style="width:42px;">S.No</th>
              <th>Recipient Name</th>
              <th>Register No.</th>
              <th>Department</th>
              <th>Award</th>
              <th>Certificate ID</th>
            </tr>
          </thead>
          <tbody>
            ${awardWinners
              .map(
                (w, i) => `
              <tr>
                <td class="num">${i + 1}</td>
                <td><strong>${esc(w.recipientName)}</strong></td>
                <td class="mono">${esc(w.registerNumber || '—')}</td>
                <td>${esc(w.department || '—')}</td>
                <td>${esc(w.awardType)}${w.awardTitle ? ` — ${esc(w.awardTitle)}` : ''}</td>
                <td class="mono">${esc(w.certId)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>`
      : '';

  const attendanceRowsHtml =
    eventCheckIns.length > 0
      ? eventCheckIns
          .map(
            (chk, idx) => `
          <tr>
            <td class="num">${idx + 1}</td>
            <td><strong>${esc(chk.userName)}</strong><br/><span class="muted">${esc(chk.userEmail)}</span></td>
            <td class="mono">${esc(chk.registerNumber)}</td>
            <td>${esc(chk.department)} · ${esc(chk.year)}</td>
            <td class="mono">${esc(chk.checkInCode)}</td>
            <td class="mono">${esc(formatTimeShort(chk.checkedInAt))}</td>
            <td style="width:92px;"></td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:18px;">No verified QR check-ins recorded for this event yet.</td></tr>`;

  const deptChipsHtml =
    deptBreakdownEntries.length > 0
      ? deptBreakdownEntries
          .map(([dept, count]) => `<span class="chip">${esc(dept)}: <strong>${count}</strong></span>`)
          .join('')
      : '<span class="muted">No department attendance recorded yet.</span>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NAAC / IQAC Activity Report — ${esc(event.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      font-size: 11.5px;
      line-height: 1.45;
      background: #ffffff;
    }
    .header {
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .college {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      margin: 0;
    }
    .subcollege {
      font-size: 11px;
      color: #475569;
      margin: 2px 0 6px 0;
    }
    .chapter {
      display: inline-block;
      padding: 3px 10px;
      border: 1px solid #047857;
      color: #047857;
      font-family: monospace;
      font-size: 10.5px;
      font-weight: 700;
      border-radius: 4px;
      letter-spacing: 0.6px;
    }
    .doc-title {
      margin: 10px 0 0 0;
      font-size: 13.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e293b;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .kpi {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 9.5px;
      font-family: monospace;
      text-transform: uppercase;
      color: #475569;
    }
    .kpi-value {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section.breakable {
      page-break-inside: auto;
    }
    h2 {
      font-size: 12px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #f1f5f9;
      border-left: 3.5px solid #047857;
      padding: 5px 10px;
      margin: 0 0 8px 0;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      font-size: 10px;
      text-transform: uppercase;
    }
    .meta-key {
      width: 24%;
      font-weight: 700;
      background: #f8fafc;
      color: #334155;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
    }
    .num {
      text-align: center;
      font-family: monospace;
    }
    .muted {
      color: #64748b;
      font-size: 9.5px;
    }
    .desc-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      white-space: pre-wrap;
      background: #ffffff;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .chip {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-family: monospace;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
      margin-top: 34px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      padding-top: 36px;
      border-top: 1px solid #334155;
    }
    .sig-role {
      font-weight: 700;
      font-size: 10.5px;
    }
    .sig-sub {
      font-size: 9.5px;
      color: #475569;
    }
    .footer-note {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #64748b;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <header class="header">
    <p class="college">${esc(siteSettings.collegeName || 'Paavai Engineering College (Autonomous)')}</p>
    <p class="subcollege">${esc(siteSettings.campusLocation || 'Paavai Nagar, NH-44, Pachal, Namakkal, Tamil Nadu')}</p>
    <div class="chapter">${esc(siteSettings.chapterName || 'HackerRank Campus Crew — Paavai')}</div>
    <p class="doc-title">NAAC / IQAC Technical Activity &amp; Verified Attendance Report</p>
  </header>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Portal Registrations</div>
      <div class="kpi-value">${eventRegs.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Verified QR Attendance</div>
      <div class="kpi-value">${eventCheckIns.length}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Turnout Rate</div>
      <div class="kpi-value">${esc(attendanceRate)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">E-Certificates Issued</div>
      <div class="kpi-value">${eventCerts.length}</div>
    </div>
  </div>

  <section class="section">
    <h2>1. Event Profile &amp; Institutional Metadata</h2>
    <table>
      <tbody>
        <tr>
          <td class="meta-key">Event Title</td>
          <td><strong>${esc(event.title)}</strong></td>
          <td class="meta-key">Category</td>
          <td>${esc(event.category)}</td>
        </tr>
        <tr>
          <td class="meta-key">Date &amp; Schedule</td>
          <td>${esc(formatDateLong(event.dateISO))}</td>
          <td class="meta-key">Venue / Hall</td>
          <td>${esc(event.venue)}</td>
        </tr>
        <tr>
          <td class="meta-key">Organized By</td>
          <td>${esc(event.createdByName)} (${esc(siteSettings.chapterName)})</td>
          <td class="meta-key">Seat Capacity</td>
          <td>${esc(event.capacity)}</td>
        </tr>
        <tr>
          <td class="meta-key">Access Scope</td>
          <td>${event.membersOnly ? 'Verified Paavai Members Only' : 'Open Campus Technical Event'}</td>
          <td class="meta-key">Portal Reference ID</td>
          <td class="mono">${esc(event.id)}</td>
        </tr>
        ${
          event.unstopUrl
            ? `<tr>
                <td class="meta-key">Unstop Event Listing</td>
                <td class="mono" colspan="3">${esc(event.unstopUrl)}${
                  event.unstopRegistrationsCount !== undefined
                    ? ` · Unstop Registrations: ${esc(event.unstopRegistrationsCount)}`
                    : ''
                }${
                  event.unstopViewsCount !== undefined
                    ? ` · Views: ${esc(event.unstopViewsCount)}`
                    : ''
                }</td>
              </tr>`
            : ''
        }
      </tbody>
    </table>
  </section>

  <section class="section">
    <h2>2. Activity Objective, Summary &amp; Department Participation</h2>
    <div class="desc-box">${esc(event.description)}</div>
    <div class="chips">${deptChipsHtml}</div>
  </section>

  ${winnersHtml}

  <section class="section breakable">
    <h2>${awardWinners.length > 0 ? '4' : '3'}. Verified QR Attendance Roster (${eventCheckIns.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:38px;">S.No</th>
          <th>Student Name &amp; Email</th>
          <th>Register No.</th>
          <th>Dept &amp; Year</th>
          <th>QR Ticket / Code</th>
          <th>Checked-In At</th>
          <th>Sign</th>
        </tr>
      </thead>
      <tbody>
        ${attendanceRowsHtml}
      </tbody>
    </table>
  </section>

  <div class="signatures">
    <div class="sig-box">
      <div class="sig-role">${esc(siteSettings.leadName || 'Campus Lead')}</div>
      <div class="sig-sub">Campus Lead · HRCC Paavai</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Faculty Coordinator</div>
      <div class="sig-sub">HackerRank Campus Crew Chapter</div>
    </div>
    <div class="sig-box">
      <div class="sig-role">Head of Department / IQAC</div>
      <div class="sig-sub">Paavai Engineering College</div>
    </div>
  </div>

  <div class="footer-note">
    <span>Generated via HRCC Paavai Portal (Verified Firestore Attendance Record)</span>
    <span>Printed: ${esc(generatedAt)}</span>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return false;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  }, 220);

  return true;
}
