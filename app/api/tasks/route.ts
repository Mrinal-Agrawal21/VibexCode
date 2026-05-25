import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

interface TaskBody {
    text: string;
    priority: "low" | "medium" | "high";
    userId: string;
}

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ message: "Missing userId" }, { status: 400 });
    }

    try {
        const snapshot = await db
            .collection("tasks")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        const tasks = snapshot.docs.map((doc) => ({ _id: doc.id, ...doc.data() }));
        return NextResponse.json(tasks);
    } catch (error) {
        const err = error as Error;
        return NextResponse.json(
            { message: "Failed to fetch tasks", error: err.message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { text, priority, userId } = (await req.json()) as TaskBody;

        if (!text || !priority || !userId) {
            return NextResponse.json(
                { message: "All fields are required" },
                { status: 400 }
            );
        }

        const taskRef = await db.collection("tasks").add({
            text,
            priority,
            userId,
            completed: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const created = await taskRef.get();
        return NextResponse.json({ _id: taskRef.id, ...created.data() });
    } catch (error) {
        const err = error as Error;
        return NextResponse.json(
            { message: "Failed to create task", error: err.message },
            { status: 500 }
        );
    }
}
