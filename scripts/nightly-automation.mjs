#!/usr/bin/env node
/**
 * HRCC Paavai — 100% Free-Tier Nightly Spark Automation (GitHub Actions)
 * Runs daily at 20:30 UTC (02:00 IST) using Firebase Admin SDK against
 * Firestore Database: ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc
 *
 * Tasks:
 *   1. Purge unverified users older than 12 hours + release their unique_* locks.
 *   2. Sync public HackerRank practice/badge solved counts for all members.
 *   3. Re-sort /leaderboard descending by score (tie-break: solvedCount, eventsAttended)
 *      and persist canonical rank numbers back to /leaderboard/{id} & /public_profiles/{uid}.
 */

import crypto from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc';
const BOOTSTRAPPED_LEAD_EMAIL = 'paavaihackerrank@gmail.com';
const UNVERIFIED_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_BATCH_OPS = 400;

function sha256Hex(raw) {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function normalizePhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

function getEmailLockId(email) {
  return sha256Hex(`email:${String(email || '').trim().toLowerCase()}`);
}

function getPhoneLockId(phone) {
  return sha256Hex(`phone:${normalizePhoneNumber(phone)}`);
}

function getCollegeEmailLockId(collegeEmail) {
  return sha256Hex(`college_email:${String(collegeEmail || '').trim().toLowerCase()}`);
}

function cleanHackerRankHandle(handle) {
  return String(handle || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/(?:www\.)?hackerrank\.com\/(?:profile\/)?/i, '')
    .replace(/\/.*$/, '')
    .trim();
}

async function commitInChunks(db, operations) {
  for (let i = 0; i < operations.length; i += MAX_BATCH_OPS) {
    const chunk = operations.slice(i, i + MAX_BATCH_OPS);
    const batch = db.batch();
    for (const applyOp of chunk) {
      applyOp(batch);
    }
    await batch.commit();
  }
}

/**
 * Fetches public HackerRank solved count for a handle from public REST endpoints.
 * Returns a non-negative integer or null if unavailable / private.
 */
async function fetchHackerRankSolvedCount(rawHandle) {
  const handle = cleanHackerRankHandle(rawHandle);
  if (!handle || !/^[a-zA-Z0-9._-]{2,60}$/.test(handle)) {
    return null;
  }

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'HRCC-Paavai-NightlySync/1.0 (+https://paavai-hackerrank.netlify.app)',
  };

  try {
    const badgesRes = await fetch(
      `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(handle)}/badges`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (badgesRes.ok) {
      const data = await badgesRes.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      if (models.length > 0) {
        const totalSolved = models.reduce(
          (sum, b) => sum + (Number.isFinite(Number(b?.solved)) ? Math.max(0, Number(b.solved)) : 0),
          0
        );
        if (totalSolved > 0) {
          return Math.floor(totalSolved);
        }
      }
    }
  } catch (err) {
    console.warn(`[HR Sync] Badges fetch failed for ${handle}:`, err?.message || err);
  }

  try {
    const profileRes = await fetch(
      `https://www.hackerrank.com/rest/contests/master/hackers/${encodeURIComponent(handle)}/profile`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (profileRes.ok) {
      const data = await profileRes.json();
      const model = data?.model;
      const candidate =
        Number(model?.solved_challenges_count) ||
        Number(model?.submissions_count) ||
        0;
      if (Number.isFinite(candidate) && candidate > 0) {
        return Math.floor(candidate);
      }
    }
  } catch (err) {
    console.warn(`[HR Sync] Profile fetch failed for ${handle}:`, err?.message || err);
  }

  return null;
}

/**
 * Task 1: Purge unverified Firebase Auth accounts older than 12 hours
 * along with their /users/{uid}, /public_profiles/{uid}, and unique_* lock docs.
 */
async function purgeExpiredUnverifiedUsers(auth, db) {
  console.log('\n[Task 1] Scanning for expired unverified accounts (>12h)...');
  const nowMs = Date.now();
  let nextPageToken;
  let purgedCount = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const authUser of page.users) {
      const emailLower = (authUser.email || '').trim().toLowerCase();
      if (authUser.emailVerified || emailLower === BOOTSTRAPPED_LEAD_EMAIL) {
        continue;
      }

      const createdMs = Date.parse(authUser.metadata?.creationTime || '');
      if (!Number.isFinite(createdMs)) continue;
      if (nowMs - createdMs < UNVERIFIED_TTL_MS) continue;

      const uid = authUser.uid;
      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get().catch(() => null);
      const userData = userSnap?.exists ? userSnap.data() : null;

      const deleteOps = [];
      if (userSnap?.exists) {
        deleteOps.push((batch) => batch.delete(userRef));
      }

      const pubRef = db.collection('public_profiles').doc(uid);
      const pubSnap = await pubRef.get().catch(() => null);
      if (pubSnap?.exists) {
        deleteOps.push((batch) => batch.delete(pubRef));
      }

      const emailToUnlock = userData?.email || authUser.email;
      if (emailToUnlock) {
        const lockId = getEmailLockId(emailToUnlock);
        const lockRef = db.collection('unique_emails').doc(lockId);
        const lockSnap = await lockRef.get().catch(() => null);
        if (lockSnap?.exists && (!lockSnap.data()?.uid || lockSnap.data()?.uid === uid)) {
          deleteOps.push((batch) => batch.delete(lockRef));
        }
      }

      if (userData?.phone) {
        const phoneLockId = getPhoneLockId(userData.phone);
        const phoneLockRef = db.collection('unique_phones').doc(phoneLockId);
        const phoneLockSnap = await phoneLockRef.get().catch(() => null);
        if (
          phoneLockSnap?.exists &&
          (!phoneLockSnap.data()?.uid || phoneLockSnap.data()?.uid === uid)
        ) {
          deleteOps.push((batch) => batch.delete(phoneLockRef));
        }
      }

      if (userData?.collegeEmail) {
        const colLockId = getCollegeEmailLockId(userData.collegeEmail);
        const colLockRef = db.collection('unique_college_emails').doc(colLockId);
        const colLockSnap = await colLockRef.get().catch(() => null);
        if (
          colLockSnap?.exists &&
          (!colLockSnap.data()?.uid || colLockSnap.data()?.uid === uid)
        ) {
          deleteOps.push((batch) => batch.delete(colLockRef));
        }
      }

      if (deleteOps.length > 0) {
        await commitInChunks(db, deleteOps);
      }

      await auth.deleteUser(uid);
      purgedCount += 1;
      console.log(`  - Purged unverified user ${uid} (${emailLower || 'no-email'})`);
    }

    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`[Task 1] Done. Purged ${purgedCount} expired unverified user(s).`);
}

/**
 * Task 2: Sync public HackerRank solved counts for every verified user with a handle.
 */
async function syncHackerRankProfiles(db) {
  console.log('\n[Task 2] Syncing public HackerRank profiles...');
  const usersSnap = await db.collection('users').get();
  const lbSnap = await db.collection('leaderboard').get();
  const pubSnap = await db.collection('public_profiles').get();

  const lbById = new Map();
  lbSnap.forEach((d) => lbById.set(d.id, d.data()));

  const pubByUid = new Map();
  pubSnap.forEach((d) => pubByUid.set(d.id, d.data()));

  const todayIso = new Date().toISOString().slice(0, 10);
  const writeOps = [];
  let checkedCount = 0;
  let updatedCount = 0;

  for (const userDoc of usersSnap.docs) {
    const u = userDoc.data();
    if (u.emailVerified === false) continue;

    const uid = userDoc.id;
    const rawHandle = String(u.hackerRankHandle || '').trim();
    const cleaned = cleanHackerRankHandle(rawHandle);
    if (!cleaned || cleaned.toLowerCase() === 'paavai_coder') continue;

    checkedCount += 1;
    const remoteSolved = await fetchHackerRankSolvedCount(cleaned);
    if (remoteSolved === null) continue;

    const existingPub = pubByUid.get(uid) || {};
    const existingLb = lbById.get(uid) || {};
    const prevSolved = Math.max(
      Number(existingPub.hackerRankSolvedCount) || 0,
      Number(existingLb.solvedCount) || 0,
      Number(existingLb.problemsSolved) || 0
    );

    const nextSolved = Math.max(prevSolved, remoteSolved);
    const delta = Math.max(0, nextSolved - prevSolved);
    const prevScore = Number(existingLb.score) || 0;
    const nextScore = prevScore + delta * 10;

    if (delta > 0 || !lbById.has(uid) || existingPub.hackerRankSolvedCount !== nextSolved) {
      updatedCount += 1;
      const displayHandle = rawHandle.startsWith('@') ? rawHandle : `@${cleaned}`;

      writeOps.push((batch) =>
        batch.set(
          db.collection('public_profiles').doc(uid),
          {
            uid,
            name: String(u.name || existingPub.name || 'Paavai Coder'),
            department: String(u.department || existingPub.department || 'CSE'),
            year: String(u.year || existingPub.year || '1st Year'),
            bio: String(u.bio || existingPub.bio || ''),
            hackerRankHandle: displayHandle,
            hackerRankSolvedCount: nextSolved,
            ...(delta > 0 ? { lastPracticeAt: todayIso } : {}),
            updatedAt: todayIso,
          },
          { merge: true }
        )
      );

      writeOps.push((batch) =>
        batch.set(
          db.collection('leaderboard').doc(uid),
          {
            uid,
            name: String(u.name || existingLb.name || 'Paavai Coder'),
            registerNumber: String(u.regNo || existingLb.registerNumber || 'N/A'),
            department: String(u.department || existingLb.department || 'CSE'),
            year: String(u.year || existingLb.year || '1st Year'),
            hackerRankHandle: displayHandle,
            problemsSolved: nextSolved,
            solvedCount: nextSolved,
            score: nextScore,
            eventsAttended: Number(existingLb.eventsAttended) || 0,
          },
          { merge: true }
        )
      );
    }

    // Gentle pacing to avoid HackerRank rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  if (writeOps.length > 0) {
    await commitInChunks(db, writeOps);
  }

  console.log(
    `[Task 2] Done. Checked ${checkedCount} handle(s), updated ${updatedCount} member(s).`
  );
}

/**
 * Task 3: Sort all /leaderboard entries descending by score -> solvedCount -> eventsAttended
 * and persist canonical rank values back to /leaderboard/{id} and /public_profiles/{uid}.
 */
async function alignLeaderboardRanks(db) {
  console.log('\n[Task 3] Aligning canonical leaderboard ranks...');
  const lbSnap = await db.collection('leaderboard').get();
  const pubSnap = await db.collection('public_profiles').get();
  const existingPubIds = new Set(pubSnap.docs.map((d) => d.id));

  const entries = lbSnap.docs.map((d) => {
    const data = d.data();
    const solved = Math.max(
      Number(data.solvedCount) || 0,
      Number(data.problemsSolved) || 0
    );
    return {
      id: d.id,
      uid: typeof data.uid === 'string' && data.uid ? data.uid : d.id,
      name: String(data.name || ''),
      score: Number(data.score) || 0,
      solved,
      eventsAttended: Number(data.eventsAttended) || 0,
      currentRank: Number(data.rank) || 0,
    };
  });

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (b.eventsAttended !== a.eventsAttended) return b.eventsAttended - a.eventsAttended;
    return a.name.localeCompare(b.name);
  });

  const writeOps = [];
  entries.forEach((entry, idx) => {
    const rank = idx + 1;
    writeOps.push((batch) =>
      batch.set(
        db.collection('leaderboard').doc(entry.id),
        {
          rank,
          problemsSolved: entry.solved,
          solvedCount: entry.solved,
        },
        { merge: true }
      )
    );

    if (existingPubIds.has(entry.uid)) {
      writeOps.push((batch) =>
        batch.set(
          db.collection('public_profiles').doc(entry.uid),
          {
            rank,
            hackerRankSolvedCount: entry.solved,
            eventsAttended: entry.eventsAttended,
          },
          { merge: true }
        )
      );
    }
  });

  if (writeOps.length > 0) {
    await commitInChunks(db, writeOps);
  }

  console.log(`[Task 3] Done. Ranked ${entries.length} leaderboard entr(ies).`);
}

/**
 * Task 4: Dispatch any queued Join Request approval/rejection emails (if SMTP or Resend secrets are configured).
 */
async function dispatchQueuedJoinRequestEmails(db) {
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();

  if (!((smtpUser && smtpPass) || resendApiKey)) {
    console.log('\n[Task 4] Skipping queued Join Request emails (no SMTP or RESEND_API_KEY configured).');
    return;
  }

  console.log('\n[Task 4] Checking queued Join Request decision emails...');
  const queuedSnap = await db
    .collection('join_requests')
    .where('emailNotificationStatus', '==', 'queued')
    .get();

  if (queuedSnap.empty) {
    console.log('[Task 4] No queued Join Request emails pending.');
    return;
  }

  const settingsSnap = await db.collection('site_settings').doc('main').get().catch(() => null);
  const settings = settingsSnap?.exists ? settingsSnap.data() : {};
  const chapterName = String(settings?.chapterName || 'HackerRank Campus Crew');
  const collegeName = String(settings?.collegeName || 'Paavai Engineering College');
  const leadName = String(settings?.leadName || 'Campus Lead');
  const leadPhone = String(settings?.leadPhone || '');
  const leadEmail = String(settings?.contactEmail || BOOTSTRAPPED_LEAD_EMAIL);

  let transporter = null;
  if (smtpUser && smtpPass) {
    const nodemailerMod = await import('nodemailer');
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailerMod.default.createTransport({
      host: String(process.env.SMTP_HOST || 'smtp.gmail.com'),
      port: smtpPort,
      secure:
        process.env.SMTP_SECURE !== undefined
          ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
          : smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  let sentCount = 0;
  for (const docSnap of queuedSnap.docs) {
    const req = docSnap.data();
    const decision = req.status;
    if (decision !== 'approved' && decision !== 'rejected') continue;
    const toEmail = String(req.email || '').trim().toLowerCase();
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(toEmail)) continue;

    const applicantName = String(req.name || 'Student').replace(/[\r\n]+/g, ' ').trim();
    const subject =
      decision === 'approved'
        ? `Approved: Welcome to ${chapterName} (${collegeName}) — Please Call the Campus Lead`
        : `Update on Your ${chapterName} Join Request (${collegeName})`;

    const text =
      decision === 'approved'
        ? [
            `Hi ${applicantName},`,
            '',
            `Congratulations! Your Join Request for ${chapterName} at ${collegeName} has been APPROVED.`,
            '',
            leadPhone
              ? `IMPORTANT NEXT STEP — PLEASE CALL THE CAMPUS LEAD:\nPlease call Campus Lead ${leadName} at ${leadPhone} (or email ${leadEmail}) to complete your onboarding.`
              : `IMPORTANT NEXT STEP — PLEASE CALL THE CAMPUS LEAD:\nPlease call our Campus Lead (${leadName}) immediately (or email ${leadEmail}) to complete your onboarding.`,
            req.reviewNote ? `\nNote from Campus Lead:\n"${String(req.reviewNote)}"` : '',
            '',
            `Warm regards,\n${leadName}\nCampus Lead, ${chapterName}`,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            `Hi ${applicantName},`,
            '',
            `Thank you for applying to ${chapterName} at ${collegeName}. After reviewing your request, we are unable to approve your application for this intake cycle.`,
            req.reviewNote ? `\nFeedback from Campus Lead:\n"${String(req.reviewNote)}"` : '',
            '',
            `You are still welcome to attend our open campus coding events and re-apply in the next drive.`,
            '',
            `Best wishes,\n${leadName}\nCampus Lead, ${chapterName}`,
          ]
            .filter(Boolean)
            .join('\n');

    try {
      if (transporter) {
        await transporter.sendMail({
          from: String(process.env.SMTP_FROM || `HRCC Paavai <${smtpUser}>`),
          to: toEmail,
          replyTo: leadEmail,
          subject,
          text,
        });
      } else {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: String(process.env.SMTP_FROM || 'HRCC Paavai <onboarding@resend.dev>'),
            to: [toEmail],
            reply_to: leadEmail,
            subject,
            text,
          }),
        });
        if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
      }

      await docSnap.ref.set(
        {
          emailNotificationStatus: 'sent',
          emailSentAt: new Date().toISOString(),
          emailError: '',
        },
        { merge: true }
      );
      sentCount += 1;
    } catch (err) {
      console.warn(`  - Failed sending queued email to ${toEmail}:`, err?.message || err);
    }
  }

  console.log(`[Task 4] Done. Dispatched ${sentCount} queued Join Request email(s).`);
}

/**
 * Task 5: Nightly Unstop Auto-Sync for all Unstop-linked campus events.
 * Strictly allows https://unstop.com / https://www.unstop.com hosts only.
 */
function parseSafeUnstopUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== 'unstop.com' && host !== 'www.unstop.com') return null;
    const idMatch =
      parsed.pathname.match(/-(\d{4,12})(?:\/|$)/) ||
      parsed.pathname.match(/\/competitions?\/(\d{4,12})(?:\/|$)/);
    return {
      url: parsed.toString(),
      competitionId: idMatch ? idMatch[1] : null,
    };
  } catch {
    return null;
  }
}

async function fetchPublicUnstopStats(rawUrl, storedCompId) {
  const parsed = parseSafeUnstopUrl(rawUrl);
  if (!parsed) return null;
  const compId = parsed.competitionId || ( /^\d{4,12}$/.test(String(storedCompId || '')) ? String(storedCompId) : null );
  const syncedAt = new Date().toISOString();

  if (compId) {
    try {
      const apiRes = await fetch(
        `https://unstop.com/api/public/competition/${encodeURIComponent(compId)}`,
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'HRCC-Paavai-NightlySync/1.0',
            Referer: 'https://unstop.com/',
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (apiRes.ok) {
        const json = await apiRes.json().catch(() => null);
        const comp = json?.data?.competition || json?.data;
        if (comp && typeof comp === 'object') {
          const regCount = Number(comp.registerCount ?? comp.regn_count ?? comp.registrations_count ?? 0);
          const viewsCount = Number(comp.viewsCount ?? comp.views_count ?? 0);
          const deadlineRaw = comp?.regnRequirements?.end_regn_dt || comp.end_date || '';
          const deadlineDate = deadlineRaw ? new Date(String(deadlineRaw)) : null;
          const unstopDeadline =
            deadlineDate && !Number.isNaN(deadlineDate.getTime())
              ? deadlineDate.toISOString().slice(0, 60)
              : '';
          const organiser = String(comp?.organisation?.name || '').trim().slice(0, 140);
          const modeRaw = String(comp.region || comp.mode || '').trim();
          const unstopMode = modeRaw
            ? modeRaw.charAt(0).toUpperCase() + modeRaw.slice(1).toLowerCase()
            : '';

          return {
            unstopCompetitionId: String(comp.id || compId).slice(0, 40),
            unstopRegistrationsCount: Number.isFinite(regCount)
              ? Math.max(0, Math.min(1000000, Math.round(regCount)))
              : 0,
            unstopViewsCount: Number.isFinite(viewsCount)
              ? Math.max(0, Math.min(10000000, Math.round(viewsCount)))
              : 0,
            ...(unstopDeadline ? { unstopDeadline } : {}),
            ...(organiser ? { unstopOrganiser: organiser } : {}),
            ...(unstopMode ? { unstopMode: unstopMode.slice(0, 60) } : {}),
            unstopSyncedAt: syncedAt,
            updatedAt: syncedAt,
          };
        }
      }
    } catch (err) {
      console.warn(`  - Unstop API fetch failed for competition ${compId}:`, err?.message || err);
    }
  }

  // Fallback: fetch validated public HTML page for embedded registerCount/viewsCount
  try {
    const htmlRes = await fetch(parsed.url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'HRCC-Paavai-NightlySync/1.0',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const regMatch = html.match(/"registerCount"\s*:\s*(\d+)/i);
      const viewsMatch = html.match(/"viewsCount"\s*:\s*(\d+)/i);
      if (regMatch || viewsMatch) {
        return {
          ...(compId ? { unstopCompetitionId: compId.slice(0, 40) } : {}),
          ...(regMatch ? { unstopRegistrationsCount: Math.min(1000000, Number(regMatch[1])) } : {}),
          ...(viewsMatch ? { unstopViewsCount: Math.min(10000000, Number(viewsMatch[1])) } : {}),
          unstopSyncedAt: syncedAt,
          updatedAt: syncedAt,
        };
      }
    }
  } catch (err) {
    console.warn(`  - Unstop HTML fallback failed for ${parsed.url}:`, err?.message || err);
  }

  return null;
}

async function syncUnstopLinkedEvents(db) {
  console.log('\n[Task 5] Syncing Unstop-linked campus events...');
  const eventsSnap = await db.collection('events').get();
  const writeOps = [];
  let linkedCount = 0;
  let updatedCount = 0;

  for (const evDoc of eventsSnap.docs) {
    const data = evDoc.data();
    const unstopUrl = String(data.unstopUrl || '').trim();
    if (!unstopUrl) continue;
    linkedCount += 1;

    const stats = await fetchPublicUnstopStats(unstopUrl, data.unstopCompetitionId);
    if (stats) {
      updatedCount += 1;
      writeOps.push((batch) => batch.set(evDoc.ref, stats, { merge: true }));
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (writeOps.length > 0) {
    await commitInChunks(db, writeOps);
  }

  console.log(
    `[Task 5] Done. Checked ${linkedCount} Unstop-linked event(s), updated ${updatedCount}.`
  );
}

async function main() {
  const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawCreds) {
    console.error(
      'Missing FIREBASE_SERVICE_ACCOUNT secret. Add your Firebase Service Account JSON to GitHub Repository Secrets.'
    );
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawCreds);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err?.message || err);
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id || 'paavai-hackerrank',
  });

  const auth = getAuth(app);
  const db = getFirestore(app, DATABASE_ID);

  console.log(
    `HRCC Paavai Nightly Automation starting against project=${serviceAccount.project_id || 'paavai-hackerrank'}, db=${DATABASE_ID}`
  );

  await purgeExpiredUnverifiedUsers(auth, db);
  await syncHackerRankProfiles(db);
  await alignLeaderboardRanks(db);
  await dispatchQueuedJoinRequestEmails(db);
  await syncUnstopLinkedEvents(db);

  console.log('\nNightly automation completed successfully.');
}

main().catch((err) => {
  console.error('Nightly automation failed:', err);
  process.exit(1);
});
