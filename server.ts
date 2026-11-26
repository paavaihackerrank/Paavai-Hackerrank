import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import {
  buildJoinRequestEmail,
  sanitizeHeaderText,
  type JoinRequestDecision,
} from './src/lib/joinRequestEmail.ts';
import { buildEventTicketEmail } from './src/lib/eventTicketEmail.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
);

const BOOTSTRAPPED_LEAD_EMAIL = 'paavaihackerrank@gmail.com';
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  role: 'lead' | 'crew' | 'member' | 'unknown';
  isLead: boolean;
  isCrewOrLead: boolean;
}

async function verifyAuthenticatedBearerToken(authHeader?: string): Promise<VerifiedCaller | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 4096) {
    return null;
  }

  try {
    // 1. Verify the Firebase ID token directly with Google Identity Toolkit (requires no Admin IAM)
    const lookupRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!lookupRes.ok) {
      return null;
    }

    const lookupData = (await lookupRes.json()) as {
      users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
    };
    const authUser = lookupData?.users?.[0];
    if (!authUser?.localId || !authUser.email) {
      return null;
    }

    const emailLower = authUser.email.trim().toLowerCase();
    const emailVerified = Boolean(authUser.emailVerified);
    if (!emailVerified) {
      return null;
    }

    if (emailLower === BOOTSTRAPPED_LEAD_EMAIL) {
      return {
        uid: authUser.localId,
        email: emailLower,
        emailVerified,
        role: 'lead',
        isLead: true,
        isCrewOrLead: true,
      };
    }

    // 2. Check Firestore /users/{uid}.role using the caller's own verified Bearer token
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const userDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/users/${encodeURIComponent(
      authUser.localId
    )}`;

    const docRes = await fetch(userDocUrl, {
      headers: { Authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!docRes.ok) {
      return {
        uid: authUser.localId,
        email: emailLower,
        emailVerified,
        role: 'unknown',
        isLead: false,
        isCrewOrLead: false,
      };
    }

    const docJson = (await docRes.json()) as {
      fields?: { role?: { stringValue?: string } };
    };
    const rawRole = docJson?.fields?.role?.stringValue || '';
    const role: VerifiedCaller['role'] =
      rawRole === 'lead' || rawRole === 'crew' || rawRole === 'member' ? rawRole : 'unknown';

    return {
      uid: authUser.localId,
      email: emailLower,
      emailVerified,
      role,
      isLead: role === 'lead',
      isCrewOrLead: role === 'lead' || role === 'crew',
    };
  } catch (err) {
    console.error('[Auth] Failed to verify Firebase token:', err);
    return null;
  }
}

const UNSTOP_ALLOWED_HOSTS = new Set(['unstop.com', 'www.unstop.com']);

function parseValidatedUnstopUrl(rawInput: string): { url: URL; competitionId: string | null } | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 500) return null;

  // Allow direct numeric Unstop competition ID as shorthand
  if (/^\d{4,12}$/.test(trimmed)) {
    return {
      url: new URL(`https://unstop.com/competitions/${trimmed}`),
      competitionId: trimmed,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (!UNSTOP_ALLOWED_HOSTS.has(host)) return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  const idMatch =
    parsed.pathname.match(/-(\d{4,12})(?:\/|$)/) ||
    parsed.pathname.match(/\/competitions?\/(\d{4,12})(?:\/|$)/) ||
    parsed.searchParams.get('id')?.match(/^(\d{4,12})$/);

  return {
    url: parsed,
    competitionId: idMatch ? idMatch[1] : null,
  };
}

function stripHtmlToPlainText(raw: string, maxLen = 950): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function mapUnstopCategory(rawType: string, title: string): 'Contest' | 'Workshop' | 'Hackathon' | 'Bootcamp' {
  const haystack = `${rawType} ${title}`.toLowerCase();
  if (haystack.includes('hackathon') || haystack.includes('hack')) return 'Hackathon';
  if (haystack.includes('workshop') || haystack.includes('webinar') || haystack.includes('seminar')) {
    return 'Workshop';
  }
  if (haystack.includes('bootcamp') || haystack.includes('camp') || haystack.includes('training')) {
    return 'Bootcamp';
  }
  return 'Contest';
}

function extractMetaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternA = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const patternB = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const match = html.match(patternA) || html.match(patternB);
  return match ? stripHtmlToPlainText(match[1], 500) : '';
}

function safeIsoOrEmpty(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

async function resolveSafeUnstopRedirect(initialUrl: URL): Promise<{ url: URL; competitionId: string | null }> {
  let current = initialUrl;
  for (let hop = 0; hop < 3; hop += 1) {
    const direct = parseValidatedUnstopUrl(current.toString());
    if (direct?.competitionId) {
      return direct;
    }
    try {
      const res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HRCC-Paavai-Portal/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
      });
      const loc = res.headers.get('location');
      if (loc && res.status >= 300 && res.status < 400) {
        const nextUrl = new URL(loc, current);
        const validatedNext = parseValidatedUnstopUrl(nextUrl.toString());
        if (!validatedNext) break;
        current = validatedNext.url;
        if (validatedNext.competitionId) return validatedNext;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  const finalCheck = parseValidatedUnstopUrl(current.toString());
  return finalCheck || { url: current, competitionId: null };
}

async function fetchUnstopEventMetadata(rawUrl: string) {
  const initial = parseValidatedUnstopUrl(rawUrl);
  if (!initial) {
    return {
      ok: false as const,
      status: 400,
      error:
        'Provide a valid https://unstop.com/... event URL (or numeric Unstop competition ID).',
    };
  }

  const resolved = initial.competitionId ? initial : await resolveSafeUnstopRedirect(initial.url);
  const competitionId = resolved.competitionId || '';
  const canonicalUrl = resolved.url.toString().slice(0, 500);
  const syncedAt = new Date().toISOString();

  // 1. Primary path: Unstop public competition JSON API
  if (competitionId) {
    try {
      const apiUrl = `https://unstop.com/api/public/competition/${encodeURIComponent(competitionId)}`;
      const apiRes = await fetch(apiUrl, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; HRCC-Paavai-Portal/1.0)',
          Referer: 'https://unstop.com/',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (apiRes.ok) {
        const payload = (await apiRes.json().catch(() => null)) as {
          data?: { competition?: Record<string, unknown> } & Record<string, unknown>;
        } | null;
        const comp = (payload?.data?.competition || payload?.data) as
          | Record<string, unknown>
          | undefined;

        if (comp && typeof comp === 'object' && (comp.title || comp.id)) {
          const title = stripHtmlToPlainText(String(comp.title || ''), 140);
          const rawDetails =
            typeof comp.details === 'string' && comp.details.trim()
              ? comp.details
              : typeof (comp.seo_details as Record<string, unknown> | undefined)?.description ===
                  'string'
                ? String((comp.seo_details as Record<string, unknown>).description)
                : '';
          const description = stripHtmlToPlainText(rawDetails, 950);
          const regReqs = (comp.regnRequirements || {}) as Record<string, unknown>;
          const org = (comp.organisation || {}) as Record<string, unknown>;
          const bannerMobile = (comp.banner_mobile || {}) as Record<string, unknown>;

          const rawRegisterCount = Number(
            comp.registerCount ?? comp.regn_count ?? comp.registrations_count ?? 0
          );
          const rawViewsCount = Number(comp.viewsCount ?? comp.views_count ?? 0);

          const startISO = safeIsoOrEmpty(comp.start_date || comp.starts_at);
          const deadlineISO = safeIsoOrEmpty(
            regReqs.end_regn_dt || comp.end_date || comp.regn_end_date
          );

          const modeRaw = String(comp.region || comp.mode || '').trim();
          const unstopMode = modeRaw
            ? modeRaw.charAt(0).toUpperCase() + modeRaw.slice(1).toLowerCase()
            : 'Online';

          const rawPrizes = Array.isArray(comp.prizes) ? comp.prizes : [];
          let prizeSummary = '';
          if (rawPrizes.length > 0) {
            const firstPrize = rawPrizes[0] as Record<string, unknown>;
            const cash = Number(firstPrize?.cash || 0);
            const titleP = String(firstPrize?.rank || firstPrize?.title || '').trim();
            if (cash > 0) {
              prizeSummary = `₹${cash.toLocaleString('en-IN')}${rawPrizes.length > 1 ? ' + more' : ''}`;
            } else if (titleP) {
              prizeSummary = titleP;
            }
          } else if (typeof comp.prize_money === 'string' || typeof comp.prize_money === 'number') {
            const pm = String(comp.prize_money).trim();
            if (pm && pm !== '0') prizeSummary = pm;
          }

          const rawPublicUrl =
            typeof comp.public_url === 'string' && comp.public_url.trim()
              ? comp.public_url.startsWith('http')
                ? comp.public_url
                : `https://unstop.com/${comp.public_url.replace(/^\/+/, '')}`
              : canonicalUrl;
          const safePublicUrl = parseValidatedUnstopUrl(rawPublicUrl)?.url.toString() || canonicalUrl;

          const rawBanner = String(
            bannerMobile.image_url || comp.banner_desktop || comp.logoUrl2 || ''
          ).trim();
          const safeBanner =
            rawBanner.startsWith('https://') && rawBanner.length <= 500 ? rawBanner : undefined;

          const organiserName = stripHtmlToPlainText(String(org.name || ''), 140);
          const city = stripHtmlToPlainText(
            String((comp.address_with_country_logo as Record<string, unknown> | undefined)?.city || ''),
            80
          );
          const venue =
            unstopMode.toLowerCase() === 'online'
              ? `Online via Unstop${organiserName ? ` · ${organiserName}` : ''}`
              : city
                ? `${city}${organiserName ? ` · ${organiserName}` : ''}`
                : organiserName || 'Paavai Engineering College / Unstop';

          return {
            ok: true as const,
            data: {
              unstopUrl: safePublicUrl.slice(0, 500),
              unstopCompetitionId: String(comp.id || competitionId).slice(0, 40),
              title: title || undefined,
              description: description || undefined,
              category: mapUnstopCategory(String(comp.type || comp.subtype || ''), title),
              dateISO: startISO || deadlineISO || undefined,
              venue: venue.slice(0, 160),
              bannerImage: safeBanner,
              unstopRegistrationsCount: Number.isFinite(rawRegisterCount)
                ? Math.max(0, Math.min(1000000, Math.round(rawRegisterCount)))
                : 0,
              unstopViewsCount: Number.isFinite(rawViewsCount)
                ? Math.max(0, Math.min(10000000, Math.round(rawViewsCount)))
                : 0,
              unstopDeadline: deadlineISO ? deadlineISO.slice(0, 60) : '',
              unstopOrganiser: organiserName,
              unstopMode: unstopMode.slice(0, 60),
              unstopPrize: prizeSummary.slice(0, 140),
              unstopSyncedAt: syncedAt,
              source: 'unstop_api' as const,
            },
          };
        }
      }
    } catch (err) {
      console.warn('[Unstop] Public API fetch failed, trying HTML fallback:', err);
    }
  }

  // 2. Fallback path: Fetch validated public Unstop HTML page and extract OG + JSON-LD metadata
  try {
    const htmlRes = await fetch(canonicalUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HRCC-Paavai-Portal/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const ogTitle = extractMetaContent(html, 'og:title').replace(/\s*\|\s*Unstop.*$/i, '').trim();
      const ogDesc = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description');
      const ogImage = extractMetaContent(html, 'og:image');

      let ldStart = '';
      let ldOrganiser = '';
      let ldVenue = '';
      const ldMatches = html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      );
      for (const m of ldMatches) {
        try {
          const parsedLd = JSON.parse(m[1]) as Record<string, unknown>;
          if (parsedLd['@type'] === 'Event' || parsedLd.startDate) {
            ldStart = safeIsoOrEmpty(parsedLd.startDate);
            const orgObj = parsedLd.organizer as Record<string, unknown> | undefined;
            if (orgObj?.name) ldOrganiser = stripHtmlToPlainText(String(orgObj.name), 140);
            const locObj = parsedLd.location as Record<string, unknown> | undefined;
            if (locObj?.name) ldVenue = stripHtmlToPlainText(String(locObj.name), 160);
          }
        } catch {
          // Ignore invalid JSON-LD blocks
        }
      }

      const regMatch = html.match(/"registerCount"\s*:\s*(\d+)/i);
      const viewsMatch = html.match(/"viewsCount"\s*:\s*(\d+)/i);
      const regCount = regMatch ? Math.min(1000000, Number(regMatch[1])) : 0;
      const viewsCount = viewsMatch ? Math.min(10000000, Number(viewsMatch[1])) : 0;

      if (ogTitle || ogDesc || competitionId) {
        return {
          ok: true as const,
          data: {
            unstopUrl: canonicalUrl,
            unstopCompetitionId: competitionId.slice(0, 40),
            title: ogTitle ? ogTitle.slice(0, 140) : undefined,
            description: ogDesc ? ogDesc.slice(0, 950) : undefined,
            category: mapUnstopCategory('', ogTitle),
            dateISO: ldStart || undefined,
            venue: ldVenue || (ldOrganiser ? `Unstop · ${ldOrganiser}` : 'Online via Unstop'),
            bannerImage:
              ogImage.startsWith('https://') && ogImage.length <= 500 ? ogImage : undefined,
            unstopRegistrationsCount: regCount,
            unstopViewsCount: viewsCount,
            unstopDeadline: '',
            unstopOrganiser: ldOrganiser,
            unstopMode: 'Online',
            unstopPrize: '',
            unstopSyncedAt: syncedAt,
            source: 'unstop_html' as const,
          },
        };
      }
    }
  } catch (err) {
    console.warn('[Unstop] HTML metadata fetch failed:', err);
  }

  return {
    ok: false as const,
    status: 502,
    error:
      'Could not reach Unstop right now for that event URL. Verify the link is a public https://unstop.com/... competition page and try again.',
  };
}

function getMailTransportConfig() {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();

  if (smtpUser && smtpPass) {
    const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpSecure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE.toLowerCase() === 'true'
        : smtpPort === 465;
    const smtpFrom = (
      process.env.SMTP_FROM || `HRCC Paavai <${smtpUser}>`
    ).trim();

    return {
      provider: 'smtp' as const,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      from: smtpFrom,
    };
  }

  if (resendApiKey) {
    const resendFrom = (
      process.env.SMTP_FROM ||
      process.env.RESEND_FROM ||
      'HRCC Paavai <onboarding@resend.dev>'
    ).trim();
    return {
      provider: 'resend' as const,
      resendApiKey,
      from: resendFrom,
    };
  }

  return { provider: 'none' as const };
}

async function dispatchAutomatedEmail(params: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
    cid?: string;
  }>;
}): Promise<
  | { ok: true; provider: 'smtp' | 'resend'; messageId: string }
  | { ok: false; reason: 'mail_not_configured' | 'send_failed'; message: string }
> {
  const config = getMailTransportConfig();

  if (config.provider === 'none') {
    return {
      ok: false,
      reason: 'mail_not_configured',
      message:
        'Automated mail credentials (SMTP_USER & SMTP_PASS, or RESEND_API_KEY) are not configured on the server yet.',
    };
  }

  if (config.provider === 'smtp') {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: config.from,
        to: params.to,
        replyTo: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
        ...(params.attachments && params.attachments.length > 0
          ? {
              attachments: params.attachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType || 'image/png',
                cid: att.cid,
              })),
            }
          : {}),
      });

      return {
        ok: true,
        provider: 'smtp',
        messageId: String(info.messageId || `smtp_${Date.now()}`),
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'SMTP delivery failed.';
      console.error('[Mail/SMTP] Delivery failed:', errMsg);
      return {
        ok: false,
        reason: 'send_failed',
        message: `SMTP send failed: ${errMsg.slice(0, 240)}`,
      };
    }
  }

  // Resend API fallback
  try {
    const resendPayload: Record<string, unknown> = {
      from: config.from,
      to: [params.to],
      reply_to: params.replyTo,
      subject: params.subject,
      text: params.text,
      html: params.html,
    };
    if (params.attachments && params.attachments.length > 0) {
      resendPayload.attachments = params.attachments.map((att) => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        ...(att.cid ? { content_id: att.cid } : {}),
      }));
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
      signal: AbortSignal.timeout(12000),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        ok: false,
        reason: 'send_failed',
        message: `Resend API error (${res.status}): ${String(data.message || 'Unknown error').slice(0, 220)}`,
      };
    }

    return {
      ok: true,
      provider: 'resend',
      messageId: String(data.id || `resend_${Date.now()}`),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Resend delivery failed.';
    console.error('[Mail/Resend] Delivery failed:', errMsg);
    return {
      ok: false,
      reason: 'send_failed',
      message: `Resend send failed: ${errMsg.slice(0, 240)}`,
    };
  }
}

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Authenticated Campus Lead check for whether automated mail transport is configured
  app.get('/api/mail/status', async (req, res) => {
    const caller = await verifyAuthenticatedBearerToken(req.headers.authorization);
    if (!caller || !caller.isLead) {
      res.status(403).json({ ok: false, error: 'Campus Lead authorization required.' });
      return;
    }

    const cfg = getMailTransportConfig();
    res.json({
      ok: true,
      configured: cfg.provider !== 'none',
      provider: cfg.provider,
    });
  });

  // Fetch public Unstop event metadata & live registration counts (Crew or Campus Lead only)
  app.post('/api/unstop/sync', async (req, res) => {
    const caller = await verifyAuthenticatedBearerToken(req.headers.authorization);
    if (!caller || !caller.isCrewOrLead) {
      res.status(403).json({
        ok: false,
        error: 'Verified Campus Crew or Campus Lead authorization is required to sync Unstop events.',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const rawUrl = typeof body.unstopUrl === 'string' ? body.unstopUrl : '';
    const result = await fetchUnstopEventMetadata(rawUrl);

    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }

    res.json({ ok: true, data: result.data });
  });

  // Send automated approval or rejection email to a Join Request applicant
  app.post('/api/join-requests/notify', async (req, res) => {
    const caller = await verifyAuthenticatedBearerToken(req.headers.authorization);
    if (!caller || !caller.isLead) {
      res.status(403).json({
        ok: false,
        delivered: false,
        reason: 'unauthorized',
        message: 'Only a verified Campus Lead can trigger Join Request notifications.',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const decision = body.decision === 'approved' || body.decision === 'rejected'
      ? (body.decision as JoinRequestDecision)
      : null;

    if (!decision) {
      res.status(400).json({
        ok: false,
        delivered: false,
        reason: 'invalid_payload',
        message: 'Decision must be either "approved" or "rejected".',
      });
      return;
    }

    const applicantEmail = sanitizeHeaderText(String(body.applicantEmail || ''), 160).toLowerCase();
    if (!EMAIL_REGEX.test(applicantEmail)) {
      res.status(400).json({
        ok: false,
        delivered: false,
        reason: 'invalid_email',
        message: 'Applicant email address is invalid.',
      });
      return;
    }

    const applicantName = sanitizeHeaderText(String(body.applicantName || 'Student'), 100);
    const registerNumber = sanitizeHeaderText(String(body.registerNumber || ''), 30);
    const department = sanitizeHeaderText(String(body.department || ''), 50);
    const year = sanitizeHeaderText(String(body.year || ''), 30);
    const reviewNote = String(body.reviewNote || '').trim().slice(0, 400);
    const leadName = sanitizeHeaderText(String(body.leadName || 'Campus Lead'), 100);
    const leadPhone = sanitizeHeaderText(String(body.leadPhone || ''), 25);
    const rawLeadEmail = sanitizeHeaderText(
      String(body.leadEmail || caller.email || BOOTSTRAPPED_LEAD_EMAIL),
      160
    ).toLowerCase();
    const leadEmail = EMAIL_REGEX.test(rawLeadEmail) ? rawLeadEmail : BOOTSTRAPPED_LEAD_EMAIL;
    const chapterName = sanitizeHeaderText(
      String(body.chapterName || 'HackerRank Campus Crew'),
      100
    );
    const collegeName = sanitizeHeaderText(
      String(body.collegeName || 'Paavai Engineering College'),
      120
    );

    let portalUrl = 'https://paavai-hackerrank.netlify.app';
    if (typeof body.portalUrl === 'string' && body.portalUrl.trim()) {
      try {
        const parsed = new URL(body.portalUrl.trim());
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          portalUrl = parsed.origin;
        }
      } catch {
        // Keep safe default portalUrl
      }
    }

    const rendered = buildJoinRequestEmail({
      applicantName,
      applicantEmail,
      registerNumber,
      department,
      year,
      decision,
      reviewNote,
      leadName,
      leadPhone,
      leadEmail,
      chapterName,
      collegeName,
      portalUrl,
    });

    const result = await dispatchAutomatedEmail({
      to: applicantEmail,
      replyTo: leadEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });

    if (result.ok) {
      res.json({
        ok: true,
        delivered: true,
        provider: result.provider,
        messageId: result.messageId,
      });
      return;
    }

    const statusCode = result.reason === 'mail_not_configured' ? 200 : 502;
    res.status(statusCode).json({
      ok: false,
      delivered: false,
      reason: result.reason,
      message: result.message,
    });
  });

  // Automated Unique Event Entry Pass QR Email (Authenticated attendee OR Campus Crew/Lead)
  app.post('/api/events/send-ticket', async (req, res) => {
    const caller = await verifyAuthenticatedBearerToken(req.headers.authorization);
    if (!caller) {
      res.status(401).json({
        ok: false,
        delivered: false,
        reason: 'unauthorized',
        message: 'Authentication required to email an Event Entry Pass QR.',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const eventId = sanitizeHeaderText(String(body.eventId || ''), 128).replace(/[^a-zA-Z0-9_-]/g, '');
    const eventTitle = sanitizeHeaderText(String(body.eventTitle || ''), 140);
    const eventCategory = sanitizeHeaderText(String(body.eventCategory || 'Campus Event'), 60);
    const eventDateISO = sanitizeHeaderText(String(body.eventDateISO || ''), 50);
    const venue = sanitizeHeaderText(String(body.venue || 'Paavai Campus'), 160);
    const attendeeUid = sanitizeHeaderText(String(body.attendeeUid || ''), 128).replace(/[^a-zA-Z0-9_-]/g, '');
    const attendeeName = sanitizeHeaderText(String(body.attendeeName || ''), 100);
    const attendeeEmail = sanitizeHeaderText(String(body.attendeeEmail || ''), 160).toLowerCase();
    const registerNumber = sanitizeHeaderText(String(body.registerNumber || ''), 24);
    const department = sanitizeHeaderText(String(body.department || 'CSE'), 40);
    const year = sanitizeHeaderText(String(body.year || '1st Year'), 20);
    const ticketCode = sanitizeHeaderText(String(body.ticketCode || ''), 64).replace(/[^a-zA-Z0-9_-]/g, '');

    if (!eventId || !eventTitle || !attendeeUid || !attendeeName || !EMAIL_REGEX.test(attendeeEmail) || ticketCode.length < 6) {
      res.status(400).json({
        ok: false,
        delivered: false,
        reason: 'invalid_payload',
        message: 'Valid event, attendee, email, and unique ticket code are required.',
      });
      return;
    }

    const isSelfOwner =
      caller.uid === attendeeUid &&
      caller.email.toLowerCase() === attendeeEmail;

    if (!caller.isCrewOrLead && !isSelfOwner) {
      res.status(403).json({
        ok: false,
        delivered: false,
        reason: 'forbidden',
        message: 'You can only send an entry pass to your own verified email address.',
      });
      return;
    }

    const rawPortalUrl = typeof body.portalUrl === 'string' ? body.portalUrl.trim() : '';
    let portalUrl = 'https://paavai-hackerrank.web.app';
    if (rawPortalUrl) {
      try {
        const parsed = new URL(rawPortalUrl);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          portalUrl = parsed.origin;
        }
      } catch {
        // Keep safe default
      }
    }

    const qrPayload = `HRCC-PASS|${eventId}|${attendeeUid}|${ticketCode}`;
    const qrCid = 'hrcc-ticket-qr';
    let qrPngBuffer: Buffer;
    try {
      qrPngBuffer = await QRCode.toBuffer(qrPayload, {
        type: 'png',
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#070B10',
          light: '#FFFFFF',
        },
      });
    } catch (err) {
      console.error('[TicketQR] Failed to generate QR PNG buffer:', err);
      res.status(500).json({
        ok: false,
        delivered: false,
        reason: 'qr_generation_failed',
        message: 'Could not generate unique QR pass image.',
      });
      return;
    }

    const rendered = buildEventTicketEmail({
      attendeeName,
      registerNumber: registerNumber || 'PEC-MEMBER',
      department,
      year,
      eventTitle,
      eventCategory,
      eventDateISO,
      venue,
      ticketCode,
      portalUrl,
      qrCid,
    });

    const result = await dispatchAutomatedEmail({
      to: attendeeEmail,
      replyTo: BOOTSTRAPPED_LEAD_EMAIL,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: [
        {
          filename: `HRCC-Entry-Pass-${ticketCode}.png`,
          content: qrPngBuffer,
          contentType: 'image/png',
          cid: qrCid,
        },
      ],
    });

    if (result.ok) {
      res.json({
        ok: true,
        delivered: true,
        provider: result.provider,
        messageId: result.messageId,
      });
      return;
    }

    const statusCode = result.reason === 'mail_not_configured' ? 200 : 502;
    res.status(statusCode).json({
      ok: false,
      delivered: false,
      reason: result.reason,
      message: result.message,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  // Baseline security headers for all responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    // Long-lived immutable caching for content-hashed Vite bundles
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    // 30-day caching for static local images
    app.use(
      '/src/assets',
      express.static(path.join(distDir, 'src/assets'), {
        maxAge: '30d',
      })
    );
    // Static root files (robots.txt, sitemap.xml)
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1d',
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[HRCC Paavai] Server running on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('[HRCC Paavai] Failed to start server:', err);
  process.exit(1);
});
