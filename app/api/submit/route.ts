// File: /app/api/submit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

const POINTS_BY_DIFFICULTY: Record<"easy" | "medium" | "hard", number> = {
    easy: 10,
    medium: 20,
    hard: 35,
};

function pointsFor(
    difficulty: string | undefined,
    passed: boolean | undefined
): number {
    if (!passed) return 0;
    if (
        difficulty === "easy" ||
        difficulty === "medium" ||
        difficulty === "hard"
    ) {
        return POINTS_BY_DIFFICULTY[difficulty];
    }
    return POINTS_BY_DIFFICULTY.easy;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            userEmail,
            userName,
            questionId,
            questionTitle,
            answerMarkdown,
            submittedAt,
            // New scoring fields (all optional for back-compat).
            passed,
            code,
            language,
            difficulty,
            runtimeMs,
            memoryKb,
        } = body || {};

        const normalizedEmail = normalizeEmail(userEmail);
        if (!normalizedEmail || !questionId || !answerMarkdown) {
            return NextResponse.json(
                {
                    ok: false,
                    error:
                        "Missing required fields: userEmail, questionId and answerMarkdown",
                },
                { status: 400 }
            );
        }

        const points = pointsFor(difficulty, passed);

        const submissionRef = await db.collection("submissions").add({
            userEmail: normalizedEmail,
            userName: userName || "",
            questionId,
            questionTitle: questionTitle || "",
            answerMarkdown,
            submittedAt: submittedAt
                ? new Date(submittedAt).toISOString()
                : new Date().toISOString(),
            passed: Boolean(passed),
            code: code || "",
            language: language || "",
            difficulty: difficulty || "",
            runtimeMs:
                typeof runtimeMs === "number" && Number.isFinite(runtimeMs)
                    ? runtimeMs
                    : null,
            memoryKb:
                typeof memoryKb === "number" && Number.isFinite(memoryKb)
                    ? memoryKb
                    : null,
            points,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const created = await submissionRef.get();
        return NextResponse.json(
            {
                success: true,
                submission: { _id: submissionRef.id, ...created.data() },
                points,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Submission POST error:", error);
        return NextResponse.json(
            { success: false, error: "Server error" },
            { status: 500 }
        );
    }
}
