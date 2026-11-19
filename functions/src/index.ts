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

/**
 * Scheduled Cloud Function: runs every hour to find and delete user accounts
 * in Firestore whose `emailVerified` is `false` for more than 12 hours, along
 * with their corresponding Firebase Auth accounts.
 */
export const cleanupUnverifiedUsers = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
  },
  async () => {
    const cutoffMs = Date.now() - UNVERIFIED_EXPIRATION_MS;

    const snapshot = await db
      .collection('users')
      .where('emailVerified', '==', false)
      .get();

    if (snapshot.empty) {
      logger.info('No unverified user documents found.');
      return;
    }

    const expiredDocs = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data();
      const rawTimestamp =
        typeof data.createdAt === 'string' && data.createdAt
          ? data.createdAt
          : typeof data.updatedAt === 'string' && data.updatedAt
            ? data.updatedAt
            : null;

      const createdMs = rawTimestamp
        ? Date.parse(rawTimestamp)
        : docSnap.createTime.toMillis();

      return Number.isFinite(createdMs) && createdMs <= cutoffMs;
    });

    if (expiredDocs.length === 0) {
      logger.info(
        `Checked ${snapshot.size} unverified user(s); none older than 12 hours.`
      );
      return;
    }

    // Delete expired Firestore user records in batches of up to 400
    for (let i = 0; i < expiredDocs.length; i += 400) {
      const batch = db.batch();
      const chunk = expiredDocs.slice(i, i + 400);
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }

    // Delete corresponding Firebase Auth users so stale unverified accounts cannot sign in
    let authDeleted = 0;
    for (const docSnap of expiredDocs) {
      try {
        await auth.deleteUser(docSnap.id);
        authDeleted += 1;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code !== 'auth/user-not-found') {
          logger.warn(`Failed to delete Firebase Auth user ${docSnap.id}:`, err);
        }
      }
    }

    logger.info(
      `Deleted ${expiredDocs.length} unverified Firestore user document(s) and ${authDeleted} Firebase Auth user(s) older than 12 hours.`
    );
  }
);
