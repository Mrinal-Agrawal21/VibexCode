import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { isAdminEmail } from "@/lib/auth";
import { toIso } from "@/lib/firestore-helpers";

// GET /api/questions/[id]
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { success: false, error: "Invalid question id" },
            { status: 400 }
        );
    }

    try {
        const doc = await db.collection("questions").doc(id).get();
        if (!doc.exists) {
            return NextResponse.json(
                { success: false, error: "Question not found" },
                { status: 404 }
            );
        }

        const data = doc.data() || {};
        return NextResponse.json(
            {
                success: true,
                question: {
                    _id: doc.id,
                    ...data,
                    createdAt: toIso(data.createdAt),
                    updatedAt: toIso(data.updatedAt),
                },
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        console.error("Error fetching question:", errorMessage);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH /api/questions/[id]
// Body: { userEmail, title?, description?, testcases?, solutions?, tags?, difficulty? }
// Admin-only. Updates only the fields that are present in the body.
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { success: false, error: "Invalid question id" },
            { status: 400 }
        );
    }

    const body = await req.json().catch(() => ({}));
    if (!isAdminEmail(body?.userEmail)) {
        return NextResponse.json(
            { success: false, error: "Only admins can edit questions" },
            { status: 403 }
        );
    }

    // Whitelist editable fields.
    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.description === "string")
        update.description = body.description.trim();
    if (typeof body.testcases === "string")
        update.testcases = body.testcases.trim();
    if (typeof body.solutions === "string")
        update.solutions = body.solutions.trim();
    if (
        typeof body.difficulty === "string" &&
        ["easy", "medium", "hard"].includes(body.difficulty)
    ) {
        update.difficulty = body.difficulty;
    }
    if (Array.isArray(body.tags)) {
        const cleanedTags: string[] = body.tags
            .filter((t: unknown): t is string => typeof t === "string")
            .map((t: string) => t.trim())
            .filter((t: string) => t.length > 0);
        update.tags = cleanedTags;
        update.tagsLower = cleanedTags.map((t) => t.toLowerCase());
    }

    if (Object.keys(update).length === 0) {
        return NextResponse.json(
            { success: false, error: "No editable fields provided" },
            { status: 400 }
        );
    }

    try {
        const docRef = db.collection("questions").doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return NextResponse.json(
                { success: false, error: "Question not found" },
                { status: 404 }
            );
        }

        await docRef.set(
            { ...update, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
        );

        const updated = await docRef.get();
        const data = updated.data() || {};
        return NextResponse.json({
            success: true,
            question: {
                _id: updated.id,
                ...data,
                createdAt: toIso(data.createdAt),
                updatedAt: toIso(data.updatedAt),
            },
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        console.error("Error updating question:", errorMessage);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/questions/[id]
//   Body: { userEmail }   — admin-only
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    const { id } = await context.params;
    if (!id) {
        return NextResponse.json(
            { success: false, error: "Invalid question id" },
            { status: 400 }
        );
    }

    const body = await req.json().catch(() => ({}));
    if (!isAdminEmail(body?.userEmail)) {
        return NextResponse.json(
            { success: false, error: "Only admins can delete questions" },
            { status: 403 }
        );
    }

    try {
        const docRef = db.collection("questions").doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return NextResponse.json(
                { success: false, error: "Question not found" },
                { status: 404 }
            );
        }

        await docRef.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to delete question";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
