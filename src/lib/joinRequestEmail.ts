/**
 * Shared email template generator for Join Request Approval / Rejection notifications.
 * Used by both the Express backend (/api/join-requests/notify) and frontend preview/fallback helpers.
 */

export type JoinRequestDecision = 'approved' | 'rejected';

export interface JoinRequestEmailPayload {
  applicantName: string;
  applicantEmail: string;
  registerNumber: string;
  department: string;
  year: string;
  decision: JoinRequestDecision;
  reviewNote?: string;
  leadName: string;
  leadPhone?: string;
  leadEmail: string;
  chapterName?: string;
  collegeName?: string;
  portalUrl?: string;
}

export interface RenderedJoinRequestEmail {
  subject: string;
  text: string;
  html: string;
}

export function sanitizeHeaderText(value: string, maxLen = 180): string {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildJoinRequestEmail(
  payload: JoinRequestEmailPayload
): RenderedJoinRequestEmail {
  const applicantName = sanitizeHeaderText(payload.applicantName || 'Student', 100);
  const registerNumber = sanitizeHeaderText(payload.registerNumber || '', 30);
  const department = sanitizeHeaderText(payload.department || '', 50);
  const year = sanitizeHeaderText(payload.year || '', 30);
  const leadName = sanitizeHeaderText(payload.leadName || 'Campus Lead', 100);
  const leadPhone = sanitizeHeaderText(payload.leadPhone || '', 25);
  const leadEmail = sanitizeHeaderText(payload.leadEmail || 'paavaihackerrank@gmail.com', 160);
  const chapterName = sanitizeHeaderText(
    payload.chapterName || 'HackerRank Campus Crew',
    100
  );
  const collegeName = sanitizeHeaderText(
    payload.collegeName || 'Paavai Engineering College',
    120
  );
  const reviewNote = String(payload.reviewNote || '').trim().slice(0, 400);
  const portalUrl = String(payload.portalUrl || 'https://paavai-hackerrank.netlify.app').replace(
    /\/+$/,
    ''
  );
  const signupUrl = `${portalUrl}/signup`;
  const cleanPhoneHref = leadPhone.replace(/[^\d+]/g, '');

  if (payload.decision === 'approved') {
    const subject = `Approved: Welcome to ${chapterName} (${collegeName}) — Please Call the Campus Lead`;

    const callInstructionText = leadPhone
      ? `IMPORTANT NEXT STEP — PLEASE CALL THE CAMPUS LEAD:\nTo complete your onboarding and join the official Campus Crew channels, please call Campus Lead ${leadName} at ${leadPhone} (or email ${leadEmail}).`
      : `IMPORTANT NEXT STEP — PLEASE CALL THE CAMPUS LEAD:\nTo complete your onboarding and join the official Campus Crew channels, please call our Campus Lead (${leadName}) immediately, or reach out via email at ${leadEmail}.`;

    const noteBlockText = reviewNote ? `\nNote from Campus Lead:\n"${reviewNote}"\n` : '';

    const text = [
      `Hi ${applicantName},`,
      '',
      `Congratulations! Your Join Request for ${chapterName} at ${collegeName} has been APPROVED.`,
      '',
      `Applicant Details:`,
      `- Name: ${applicantName}`,
      `- Register Number: ${registerNumber}`,
      `- Department / Year: ${department} (${year})`,
      '',
      callInstructionText,
      noteBlockText,
      `If you have not already created your verified member account on the portal, complete signup here:`,
      signupUrl,
      '',
      `We are excited to code, compete, and build with you!`,
      '',
      `Warm regards,`,
      `${leadName}`,
      `Campus Lead, ${chapterName}`,
      collegeName,
      leadPhone ? `Phone: ${leadPhone}` : '',
      `Email: ${leadEmail}`,
    ]
      .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
      .join('\n');

    const safeApplicant = escapeHtml(applicantName);
    const safeReg = escapeHtml(registerNumber);
    const safeDept = escapeHtml(department);
    const safeYear = escapeHtml(year);
    const safeLeadName = escapeHtml(leadName);
    const safeLeadPhone = escapeHtml(leadPhone);
    const safeLeadEmail = escapeHtml(leadEmail);
    const safeChapter = escapeHtml(chapterName);
    const safeCollege = escapeHtml(collegeName);
    const safeNote = escapeHtml(reviewNote);
    const safeSignupUrl = escapeHtml(signupUrl);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0F14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#121821;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background-color:#0F172A;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#00EA64;font-weight:700;">
                ${safeChapter} · ${safeCollege}
              </p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#FFFFFF;">
                Your Join Request Has Been Approved!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#E2E8F0;">
                Hi <strong>${safeApplicant}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#CBD5E1;">
                Congratulations! Your application to join the <strong style="color:#FFFFFF;">${safeChapter}</strong> at ${safeCollege} has been <strong style="color:#00EA64;">APPROVED</strong>.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0F14;border:1px solid #1E293B;border-radius:10px;margin:0 0 20px;">
                <tr>
                  <td style="padding:14px 18px;font-size:13px;line-height:1.7;color:#94A3B8;font-family:monospace;">
                    <div><strong style="color:#E2E8F0;">Register No:</strong> ${safeReg}</div>
                    <div><strong style="color:#E2E8F0;">Department:</strong> ${safeDept} (${safeYear})</div>
                    <div><strong style="color:#E2E8F0;">Status:</strong> <span style="color:#00EA64;font-weight:700;">APPROVED</span></div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#052E16;border:1px solid #00EA64;border-radius:12px;margin:0 0 20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 8px;font-family:monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#00EA64;">
                      Action Required — Call the Campus Lead
                    </p>
                    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#ECFDF5;">
                      To complete your onboarding and get added to the official crew channels, <strong>please call the Campus Lead (${safeLeadName})</strong>${
                        safeLeadPhone
                          ? ` at <a href="tel:${escapeHtml(cleanPhoneHref)}" style="color:#00EA64;font-weight:700;text-decoration:underline;">${safeLeadPhone}</a>`
                          : ' as soon as possible'
                      }.
                    </p>
                    <p style="margin:0;font-size:12px;color:#A7F3D0;">
                      Backup Email: <a href="mailto:${safeLeadEmail}" style="color:#00EA64;text-decoration:underline;">${safeLeadEmail}</a>
                    </p>
                  </td>
                </tr>
              </table>

              ${
                safeNote
                  ? `<div style="margin:0 0 20px;padding:14px 16px;background-color:#0F172A;border-left:3px solid #00EA64;border-radius:6px;">
                      <p style="margin:0 0 4px;font-family:monospace;font-size:11px;text-transform:uppercase;color:#94A3B8;">Note from Campus Lead</p>
                      <p style="margin:0;font-size:14px;line-height:1.5;color:#E2E8F0;">${safeNote}</p>
                    </div>`
                  : ''
              }

              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#CBD5E1;">
                If you haven&rsquo;t already created your verified member account on our portal, sign up below to unlock the campus leaderboard, learning roadmaps, and event QR check-ins:
              </p>

              <p style="margin:0 0 24px;">
                <a href="${safeSignupUrl}" style="display:inline-block;padding:12px 22px;background-color:#00EA64;color:#0B0F14;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;font-family:monospace;">
                  Open HRCC Paavai Portal →
                </a>
              </p>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;border-top:1px solid #1E293B;padding-top:16px;">
                Warm regards,<br />
                <strong style="color:#E2E8F0;">${safeLeadName}</strong><br />
                Campus Lead · ${safeChapter}, ${safeCollege}
                ${safeLeadPhone ? `<br />Call: ${safeLeadPhone}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject, text, html };
  }

  // Rejected / Declined email
  const subject = `Update on Your ${chapterName} Join Request (${collegeName})`;
  const noteBlockText = reviewNote ? `\nFeedback from Campus Lead:\n"${reviewNote}"\n` : '';

  const text = [
    `Hi ${applicantName},`,
    '',
    `Thank you for your interest in joining ${chapterName} at ${collegeName}.`,
    '',
    `After reviewing your join request (${registerNumber} · ${department}, ${year}), we are unable to approve your application for the current intake cycle.`,
    noteBlockText,
    `You are still warmly welcome to attend our open campus workshops, practice Data Structures & Algorithms on HackerRank, and re-apply in our next intake drive!`,
    '',
    `If you have any questions, feel free to contact us at ${leadEmail}.`,
    '',
    `Best wishes,`,
    `${leadName}`,
    `Campus Lead, ${chapterName}`,
    collegeName,
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n');

  const safeApplicant = escapeHtml(applicantName);
  const safeReg = escapeHtml(registerNumber);
  const safeDept = escapeHtml(department);
  const safeYear = escapeHtml(year);
  const safeLeadName = escapeHtml(leadName);
  const safeLeadEmail = escapeHtml(leadEmail);
  const safeChapter = escapeHtml(chapterName);
  const safeCollege = escapeHtml(collegeName);
  const safeNote = escapeHtml(reviewNote);
  const safePortalUrl = escapeHtml(portalUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#E2E8F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0F14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#121821;border:1px solid #1E293B;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background-color:#0F172A;border-bottom:1px solid #1E293B;">
              <p style="margin:0;font-family:monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94A3B8;font-weight:700;">
                ${safeChapter} · ${safeCollege}
              </p>
              <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#FFFFFF;">
                Update on Your Join Request
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#E2E8F0;">
                Hi <strong>${safeApplicant}</strong>,
              </p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#CBD5E1;">
                Thank you for applying to join <strong style="color:#FFFFFF;">${safeChapter}</strong> at ${safeCollege}. After reviewing your request (${safeReg} · ${safeDept}, ${safeYear}), we are unable to approve your application for this intake cycle.
              </p>

              ${
                safeNote
                  ? `<div style="margin:0 0 20px;padding:14px 16px;background-color:#0F172A;border-left:3px solid #F59E0B;border-radius:6px;">
                      <p style="margin:0 0 4px;font-family:monospace;font-size:11px;text-transform:uppercase;color:#94A3B8;">Feedback from Campus Lead</p>
                      <p style="margin:0;font-size:14px;line-height:1.5;color:#E2E8F0;">${safeNote}</p>
                    </div>`
                  : ''
              }

              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#CBD5E1;">
                Please do not be discouraged — you are always welcome to participate in our open campus coding events, follow our public DSA roadmap, and re-apply during the next semester drive.
              </p>

              <p style="margin:0 0 24px;">
                <a href="${safePortalUrl}/events" style="display:inline-block;padding:10px 20px;background-color:#1E293B;color:#FFFFFF;font-weight:600;font-size:13px;text-decoration:none;border-radius:8px;font-family:monospace;border:1px solid #334155;">
                  Explore Public Events →
                </a>
              </p>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;border-top:1px solid #1E293B;padding-top:16px;">
                Best wishes,<br />
                <strong style="color:#E2E8F0;">${safeLeadName}</strong><br />
                Campus Lead · ${safeChapter}, ${safeCollege}<br />
                Email: <a href="mailto:${safeLeadEmail}" style="color:#00EA64;text-decoration:none;">${safeLeadEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function buildJoinRequestMailtoHref(payload: JoinRequestEmailPayload): string {
  const { subject, text } = buildJoinRequestEmail(payload);
  const to = encodeURIComponent(payload.applicantEmail.trim());
  const qSubject = encodeURIComponent(subject);
  const qBody = encodeURIComponent(text);
  return `mailto:${to}?subject=${qSubject}&body=${qBody}`;
}
