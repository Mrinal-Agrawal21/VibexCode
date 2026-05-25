import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

// GET the current user's clan, by email.
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userEmail = normalizeEmail(searchParams.get("userEmail"));

        if (!userEmail) {
            return NextResponse.json(
                { message: "userEmail is required" },
                { status: 400 }
            );
        }

        const membershipSnap = await db
            .collection("clanMembers")
            .where("email", "==", userEmail)
            .limit(1)
            .get();
        if (membershipSnap.empty) {
            return NextResponse.json(
                { message: "User not in a clan" },
                { status: 404 }
            );
        }

        const membership = membershipSnap.docs[0].data() as { clanId?: string };
        if (!membership.clanId) {
            return NextResponse.json(
                { message: "User not in a clan" },
                { status: 404 }
            );
        }

        const clanSnap = await db.collection("clans").doc(membership.clanId).get();
        if (!clanSnap.exists) {
            await membershipSnap.docs[0].ref.delete();
            return NextResponse.json(
                { message: "User not in a clan" },
                { status: 404 }
            );
        }

        const clan = clanSnap.data() || {};
        const memberCountSnap = await db
            .collection("clanMembers")
            .where("clanId", "==", membership.clanId)
            .get();

        return NextResponse.json({
            $id: clanSnap.id,
            name: clan.name || "",
            tag: clan.tag || "",
            memberCount: memberCountSnap.size,
            ownerEmail: clan.ownerEmail || "",
        });
    } catch (error) {
        const errMessage =
            error instanceof Error ? error.message : "Unknown server error";
        return NextResponse.json(
            { message: "Server error", error: errMessage },
            { status: 500 }
        );
    }
}
