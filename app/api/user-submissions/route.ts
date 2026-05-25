// File: /app/api/user-submissions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = normalizeEmail(searchParams.get("userEmail"));
    if (!userEmail) {
      return NextResponse.json({ success: false, error: "Missing userEmail parameter" }, { status: 400 });
    }

    const snapshot = await db
      .collection("submissions")
      .where("userEmail", "==", userEmail)
      .orderBy("submittedAt", "desc")
      .get();

    const submissions = snapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, submissions }, { status: 200 });
  } catch (error) {
    console.error("Submission GET error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
