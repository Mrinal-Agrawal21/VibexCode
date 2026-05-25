import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

// POST to create a new clan. The creator automatically joins as owner.
export async function POST(request: NextRequest) {
    try {
        const { userEmail, name } = await request.json();
        const email = normalizeEmail(userEmail);

        if (!email || !name?.trim()) {
            return NextResponse.json(
                { message: "userEmail and name are required" },
                { status: 400 }
            );
        }

        const existingMembership = await db
            .collection("clanMembers")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (!existingMembership.empty) {
            return NextResponse.json(
                { message: "User is already in a clan" },
                { status: 409 }
            );
        }

        const tag = name.trim().substring(0, 4).toUpperCase();
        const clanRef = await db.collection("clans").add({
            name: name.trim(),
            tag,
            ownerEmail: email,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const memberDocId = `${clanRef.id}__${email}`;
        await db.collection("clanMembers").doc(memberDocId).set({
            clanId: clanRef.id,
            email,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            $id: clanRef.id,
            name: name.trim(),
            tag,
            memberCount: 1,
            ownerEmail: email,
        });
    } catch (error) {
        const errMessage =
            error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: "Failed to create clan", error: errMessage },
            { status: 500 }
        );
    }
}
