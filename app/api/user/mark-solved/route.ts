import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail, toDate } from "@/lib/firestore-helpers";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";

// POST /api/user/mark-solved
// Body: { userEmail, questionId, submittedAnswer?, language?, executionStats? }
//
// NOTE: previous implementation verified an Appwrite JWT and looked up the
// user by appwriteId. We now identify via email (matches the trust model
// used by /api/submit). See lib/auth.ts for the security caveat.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userEmail,
      questionId,
      submittedAnswer,
      language,
      executionStats,
    } = body || {};

    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Invalid userEmail" }, { status: 400 });
    }
    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json({ error: "Invalid questionId" }, { status: 400 });
    }

    const users = db.collection("users");
    const snapshot = await users
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRef = snapshot.docs[0].ref as DocumentReference;
    let alreadySolved = false;

    await db.runTransaction(async (tx: Transaction) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return;
      const data = userSnap.data() || {};
      const solvedQuestions = Array.isArray(data.solvedQuestions)
        ? [...data.solvedQuestions]
        : [];
      const solvedQuestionIds = Array.isArray(data.solvedQuestionIds)
        ? [...data.solvedQuestionIds]
        : [];

      alreadySolved = solvedQuestions.some(
        (sq) => sq?.questionId === questionId
      );
      if (alreadySolved) return;

      solvedQuestions.push({
        questionId,
        solvedAt: new Date().toISOString(),
        submittedAnswer: submittedAnswer || "",
        language: language || "Javascript",
        executionStats: executionStats || {},
      });

      if (!solvedQuestionIds.includes(questionId)) {
        solvedQuestionIds.push(questionId);
      }

      const stats = {
        ...(typeof data.stats === "object" && data.stats ? data.stats : {}),
      } as {
        totalSolved?: number;
        currentStreak?: number;
        longestStreak?: number;
        lastActiveDate?: string | Date;
      };

      stats.totalSolved = solvedQuestions.length;
      stats.lastActiveDate = new Date().toISOString();

      const today = new Date();
      const lastActive = toDate(stats.lastActiveDate) || today;
      const daysDiff = Math.floor(
        (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= 1) {
        stats.currentStreak = (stats.currentStreak || 0) + 1;
        stats.longestStreak = Math.max(
          stats.longestStreak || 0,
          stats.currentStreak
        );
      } else {
        stats.currentStreak = 1;
      }

      tx.set(
        userRef,
        {
          solvedQuestions,
          solvedQuestionIds,
          stats,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true, alreadySolved });
  } catch (error) {
    console.error("Error marking solved question:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
