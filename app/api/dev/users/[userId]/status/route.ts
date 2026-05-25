// PUT /api/dev/users/[userId]/status
// Body: { status: "Online" | "Idle" | "Busy" | "Offline" }
//
// Updates the user's status field on the Firestore Users document.
// Previously used node-appwrite's users.updatePrefs(); migrated to Firestore.

import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

const ALLOWED_STATUSES = ["Online", "Idle", "Busy", "Offline"] as const;
type UserStatus = (typeof ALLOWED_STATUSES)[number];

function isUserStatus(s: unknown): s is UserStatus {
  return (
    typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s)
  );
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body || {};

  if (!isUserStatus(status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const users = db.collection("users");
    const byId = await users.doc(userId).get();
    if (byId.exists) {
      await byId.ref.set(
        { status, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return NextResponse.json({ message: "Status updated", status });
    }

    const byUid = await users.where("firebaseUid", "==", userId).limit(1).get();
    if (!byUid.empty) {
      await byUid.docs[0].ref.set(
        { status, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return NextResponse.json({ message: "Status updated", status });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
