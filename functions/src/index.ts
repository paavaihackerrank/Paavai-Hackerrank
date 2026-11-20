import { createHash } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-hackerrankcampus-521e66b2-ef2a-4b15-a7c4-9be9472b4dbc';

const UNVERIFIED_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours

const app = getApps().length ? getApp() : initializeApp();
const db =
  FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
    ? getFirestore(app, FIRESTORE_DATABASE_ID)
    : getFirestore(app);
const auth = getAuth(app);

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Scheduled Cloud Function: runs every 24 hours to query all Firestore users
 * where `emailVerified` is `false` and `createdAt` is older than 12 hours,
 * then deletes those Firestore documents, their uniqueness lock docs, and their Auth accounts.
 */
export const cleanupUnverifiedUsers = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
  },
  async () => {
    const cutoffISO = new Date(Date.now() - UNVERIFIED_EXPIRATION_MS).toISOString();

    const snapshot = await db
      .collection('users')
      .where('emailVerified', '==', false)
      .where('createdAt', '<=', cutoffISO)
      .get();

    if (snapshot.empty) {
      logger.info(`No unverified user accounts older than ${cutoffISO} found.`);
      return;
    }

    // Delete expired Firestore user documents and uniqueness locks in batches of up to 400 ops
    const refsToDelete = [];
    for (const docSnap of snapshot.docs) {
      refsToDelete.push(docSnap.ref);
      const data = docSnap.data();
      const personalEmail = String(data.email || '').trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(personalEmail)) {
        const emailLockHash = sha256Hex(`email:${personalEmail}`);
        refsToDelete.push(db.collection('unique_emails').doc(emailLockHash));
      }
      const phone = normalizePhone(String(data.phone || ''));
      if (/^\d{10,15}$/.test(phone)) {
        const phoneHash = sha256Hex(`phone:${phone}`);
        refsToDelete.push(db.collection('unique_phones').doc(phoneHash));
      }
      const collegeEmail = String(data.collegeEmail || '').trim().toLowerCase();
      if (/^[a-z0-9._%+\-]+@([a-z0-9\-]+\.)*paavai\.edu\.in$/i.test(collegeEmail)) {
        const emailHash = sha256Hex(`college_email:${collegeEmail}`);
        refsToDelete.push(db.collection('unique_college_emails').doc(emailHash));
      }
    }

    for (let i = 0; i < refsToDelete.length; i += 400) {
      const batch = db.batch();
      const chunk = refsToDelete.slice(i, i + 400);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // Delete corresponding Firebase Auth accounts
    let authDeleted = 0;
    for (const docSnap of snapshot.docs) {
      try {
        await auth.deleteUser(docSnap.id);
        authDeleted += 1;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== 'auth/user-not-found') {
          logger.warn(`Failed to delete Firebase Auth account ${docSnap.id}:`, err);
        }
      }
    }

    logger.info(
      `Deleted ${snapshot.size} unverified Firestore user document(s) and ${authDeleted} Firebase Auth account(s) created before ${cutoffISO}.`
    );
  }
);
