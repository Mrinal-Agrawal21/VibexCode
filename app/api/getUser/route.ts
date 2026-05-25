// app/api/getUser/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const snapshot = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = snapshot.docs[0].data();
    return NextResponse.json({ username: user.username || "" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
