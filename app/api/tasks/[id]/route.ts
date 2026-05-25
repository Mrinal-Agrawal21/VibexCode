import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

// PATCH
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { completed, userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ message: "Missing userId" }, { status: 400 });
    }
    if (!id) {
        return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    try {
        const taskRef = db.collection("tasks").doc(id);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) {
            return NextResponse.json(
                { message: "Task not found or not yours" },
                { status: 404 }
            );
        }

        const task = taskSnap.data() || {};
        if (task.userId !== userId) {
            return NextResponse.json(
                { message: "Task not found or not yours" },
                { status: 404 }
            );
        }

        await taskRef.set(
            { completed: Boolean(completed), updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
        );

        const updated = await taskRef.get();
        return NextResponse.json({ success: true, task: { _id: id, ...updated.data() } });
    } catch (error) {
        const err = error as Error;
        return NextResponse.json(
            { message: "Failed to update task", error: err.message },
            { status: 500 }
        );
    }
}

// DELETE
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { userId } = await req.json();

    if (!userId) {
        return NextResponse.json({ message: "Missing userId" }, { status: 400 });
    }

    if (!id) {
        return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    try {
        const taskRef = db.collection("tasks").doc(id);
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) {
            return NextResponse.json(
                { message: "Task not found or not yours" },
                { status: 404 }
            );
        }

        const task = taskSnap.data() || {};
        if (task.userId !== userId) {
            return NextResponse.json(
                { message: "Task not found or not yours" },
                { status: 404 }
            );
        }

        await taskRef.delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        const err = error as Error;
        return NextResponse.json(
            { message: "Failed to delete task", error: err.message },
            { status: 500 }
        );
    }
}
