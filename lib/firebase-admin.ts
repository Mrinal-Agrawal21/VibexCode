import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

type ServiceAccount = {
    projectId: string;
    clientEmail: string;
    privateKey: string;
};

function parseServiceAccount(): ServiceAccount | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<ServiceAccount> & {
                private_key?: string;
                client_email?: string;
                project_id?: string;
            };
            if (parsed.private_key && parsed.client_email && parsed.project_id) {
                return {
                    projectId: parsed.project_id,
                    clientEmail: parsed.client_email,
                    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
                };
            }
        } catch {
            return null;
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

function getProjectId(): string | undefined {
    return (
        process.env.FIREBASE_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    );
}

const serviceAccount = parseServiceAccount();
const app =
    getApps().length > 0
        ? getApps()[0]
        : initializeApp(
                serviceAccount
                    ? {
                            credential: cert(serviceAccount),
                            projectId: getProjectId(),
                        }
                    : {
                            projectId: getProjectId(),
                        }
            );

const db = getFirestore(app);
const auth = getAuth(app);

export { auth, db, FieldValue, Timestamp };
