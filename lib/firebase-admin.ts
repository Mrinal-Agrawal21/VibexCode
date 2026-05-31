// Server-side Firebase Admin SDK initialization.
//
// Used by all /api routes for Firestore reads/writes (bypasses client-side
// security rules — server is trusted). Auth verification also flows through
// this module.
//
// Credentials are read from one of (first match wins):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON — entire service-account-key.json content
//      as a single-line JSON string. Recommended for Netlify/Vercel.
//   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY — the
//      three fields split out into separate env vars.
//   3. GOOGLE_APPLICATION_CREDENTIALS — application default credentials,
//      for local development against an emulator or `gcloud auth` session.
//
// Initialization is lazy: we don't touch credentials until the first
// `db.collection(...)` / `auth.someCall(...)` runs. That way `next build`
// can collect page data on an unconfigured environment, and only actual
// runtime requests fail (loudly) if credentials are missing.

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.private_key && parsed.client_email && parsed.project_id) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // fall through to env-var triple
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

let cachedApp: App | null = null;

function getApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  const sa = parseServiceAccount();
  const useAdc = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!sa && !useAdc) {
    throw new Error(
      "❌ Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON, " +
        "or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, " +
        "or GOOGLE_APPLICATION_CREDENTIALS in your environment."
    );
  }
  cachedApp = initializeApp(
    sa
      ? { credential: cert(sa), projectId: sa.projectId }
      : { credential: applicationDefault() }
  );
  return cachedApp;
}

// `db` and `auth` are Proxy objects that initialize the Admin SDK on first
// real method access. Calling `.collection()` / `.createUser()` will throw
// with the clear "credentials missing" message above if env isn't set.
const db = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const real = getFirestore(getApp());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

const auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    const real = getAuth(getApp());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { auth, db, FieldValue, Timestamp };
