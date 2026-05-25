import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { isAdminEmail } from "@/lib/auth";
import { toIso } from "@/lib/firestore-helpers";

type LeanQuestion = {
    _id: string;
    title: string;
    description: string;
    testcases: string;
    solutions: string;
    tags: string[];
    difficulty: "easy" | "medium" | "hard";
    createdAt: string;
    updatedAt: string;
};

export async function POST(req: Request) {
    try {
        const data = await req.json();

        // Admin gate. See lib/auth.ts for the security caveat — userEmail comes
        // from the client and can be spoofed until we move to server-verified
        // tokens. Sufficient for stopping accidental misuse via the UI.
        if (!isAdminEmail(data.userEmail)) {
            return NextResponse.json(
                { success: false, error: "Only admins can create questions" },
                { status: 403 }
            );
        }

        const {
            title,
            description,
            testcases = "",
            solutions = "",
            tags = [],
            difficulty = "easy",
        } = data;

        // Validate input
        if (!title?.trim()) {
            return NextResponse.json(
                { success: false, error: "Title is required" },
                { status: 400 }
            );
        }

        if (!description?.trim()) {
            return NextResponse.json(
                { success: false, error: "Description is required" },
                { status: 400 }
            );
        }

        const difficultyValue = typeof difficulty === "string" ? difficulty : "easy";
        if (!["easy", "medium", "hard"].includes(difficultyValue)) {
            return NextResponse.json(
                { success: false, error: "Difficulty must be one of easy, medium, hard" },
                { status: 400 }
            );
        }

        const cleanedTags = Array.isArray(tags)
            ? tags.map((t: string) => t.trim()).filter((t) => t.length > 0)
            : [];

        const docRef = await db.collection("questions").add({
            title: title.trim(),
            description: description.trim(),
            testcases: typeof testcases === "string" ? testcases.trim() : "",
            solutions: typeof solutions === "string" ? solutions.trim() : "",
            tags: cleanedTags,
            tagsLower: cleanedTags.map((t) => t.toLowerCase()),
            difficulty: difficultyValue,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const created = await docRef.get();
        const dataOut = created.data() || {};

        return NextResponse.json({
            success: true,
            question: {
                _id: docRef.id,
                title: dataOut.title || "",
                description: dataOut.description || "",
                testcases: dataOut.testcases || "",
                solutions: dataOut.solutions || "",
                tags: Array.isArray(dataOut.tags) ? dataOut.tags : [],
                difficulty:
                    dataOut.difficulty === "easy" ||
                        dataOut.difficulty === "medium" ||
                        dataOut.difficulty === "hard"
                        ? dataOut.difficulty
                        : "easy",
                createdAt: toIso(dataOut.createdAt) || new Date().toISOString(),
                updatedAt: toIso(dataOut.updatedAt) || new Date().toISOString(),
            },
        });
    } catch (error) {
        const err = error as Error;
        const message = err.message || "Unknown error";

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "0");

        let query = db.collection("questions").orderBy("createdAt", "desc");
        if (limit > 0) {
            query = query.limit(limit);
        }

        const snapshot = await query.get();
        const questions: LeanQuestion[] = snapshot.docs.map((doc) => {
            const q = doc.data();
            return {
                _id: doc.id,
                title: q.title || "",
                description: q.description || "",
                testcases: q.testcases || "",
                solutions: q.solutions || "",
                tags: Array.isArray(q.tags) ? q.tags : [],
                difficulty:
                    q.difficulty === "easy" ||
                        q.difficulty === "medium" ||
                        q.difficulty === "hard"
                        ? q.difficulty
                        : "easy",
                createdAt: toIso(q.createdAt) || new Date().toISOString(),
                updatedAt: toIso(q.updatedAt) || new Date().toISOString(),
            };
        });

        return NextResponse.json({
            success: true,
            questions,
            count: questions.length,
        });
    } catch (error) {
        const err = error as Error;
        return NextResponse.json(
            { success: false, error: "Failed to fetch questions", details: err.message },
            { status: 500 }
        );
    }
}

export async function HEAD() {
    try {
        await db.collection("questions").limit(1).get();
        return new Response(null, { status: 200 });
    } catch {
        return new Response(null, { status: 503 });
    }
}
