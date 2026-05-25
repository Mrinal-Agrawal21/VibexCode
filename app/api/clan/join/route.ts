import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const { userEmail, clanId } = await request.json();
        const email = normalizeEmail(userEmail);

        if (!email || !clanId) {
            return NextResponse.json(
                { message: "userEmail and clanId are required" },
                { status: 400 }
            );
        }

        const clanSnap = await db.collection("clans").doc(clanId).get();
        if (!clanSnap.exists) {
            return NextResponse.json(
                { message: "Clan not found" },
                { status: 404 }
            );
        }

        const existing = await db
            .collection("clanMembers")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (!existing.empty) {
            return NextResponse.json(
                { message: "User is already in a clan" },
                { status: 409 }
            );
        }

        const memberDocId = `${clanId}__${email}`;
        await db.collection("clanMembers").doc(memberDocId).set({
            email,
            clanId,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ message: "Successfully joined clan" });
    } catch (error) {
        const errMessage =
            error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: "Failed to join clan", error: errMessage },
            { status: 500 }
        );
    }
}
