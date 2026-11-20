import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
  ...(firebaseAppletConfig.measurementId
    ? { measurementId: firebaseAppletConfig.measurementId }
    : {}),
};

const app = initializeApp(firebaseConfig);

// Initialize Analytics only when a measurementId is configured and supported
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (firebaseAppletConfig.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics initialization errors in restricted contexts
    });
}

// CRITICAL: Pass firestoreDatabaseId so queries hit the provisioned Firestore database.
export const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const CAMPUS_LEAD_EMAIL = '622123104144@paavai.edu.in';
export const BOOTSTRAPPED_ADMIN_EMAIL = CAMPUS_LEAD_EMAIL;
export const BOOTSTRAPPED_ADMIN_EMAILS = [CAMPUS_LEAD_EMAIL] as const;

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  const lower = (email || '').trim().toLowerCase();
  return (BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(lower);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
  }
}

testConnection();
