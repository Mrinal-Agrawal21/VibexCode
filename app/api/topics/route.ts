// GET /api/topics
//
// Returns the distinct tags currently used by Questions, with a count of
// how many problems carry each tag. Replaces the old hardcoded
// dummyQuestions categories list.
//
// Shape: [{ name: "Arrays", count: 12 }, ...]

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await db.collection("questions").get();
    const counts: Record<string, number> = {};

    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const tags = Array.isArray(data.tags) ? data.tags : [];
      tags.forEach((tag) => {
        if (typeof tag === "string" && tag.trim()) {
          const key = tag.trim();
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });

    const topics = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ success: true, topics });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch topics";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
