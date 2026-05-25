import { NextRequest, NextResponse } from "next/server";
import { auth, db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

/**
 * POST /api/signup
 *
 * Two supported shapes (back-compat):
 *
 *  - Firebase path (preferred):
 *    { firebaseUid, email, username }
 *    Creates a Firestore Users record linked to a Firebase Auth account.
 *    Idempotent — returns 200 if the user already exists.
 *
 *  - Legacy password path (server-side Firebase Auth create):
 *    { email, password, username }
 *    Creates a Firebase Auth account and matching Firestore Users record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username, firebaseUid } = body || {};

    if (!email || !username) {
      return NextResponse.json(
        { message: "email and username are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json(
        { message: "Invalid email" },
        { status: 400 }
      );
    }

    let resolvedUid = typeof firebaseUid === "string" ? firebaseUid : "";

    if (!resolvedUid && password) {
      const created = await auth.createUser({
        email: normalizedEmail,
        password,
        displayName: username,
      });
      resolvedUid = created.uid;
    }

    if (!resolvedUid) {
      return NextResponse.json(
        { message: "firebaseUid or password is required" },
        { status: 400 }
      );
    }

    const users = db.collection("users");
    const byId = await users.doc(resolvedUid).get();
    if (byId.exists) {
      const data = byId.data() || {};
      return NextResponse.json(
        {
          message: "User already exists",
          user: {
            email: (data.email as string) || normalizedEmail,
            username: (data.username as string) || username,
          },
        },
        { status: 200 }
      );
    }

    const byEmail = await users.where("email", "==", normalizedEmail).limit(1).get();
    if (!byEmail.empty) {
      const existing = byEmail.docs[0];
      await existing.ref.set(
        { firebaseUid: resolvedUid, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      const data = existing.data();
      return NextResponse.json(
        {
          message: "User already exists",
          user: {
            email: (data.email as string) || normalizedEmail,
            username: (data.username as string) || username,
          },
        },
        { status: 200 }
      );
    }

    await users.doc(resolvedUid).set({
      email: normalizedEmail,
      username,
      name: username,
      firebaseUid: resolvedUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: { email: normalizedEmail, username },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
