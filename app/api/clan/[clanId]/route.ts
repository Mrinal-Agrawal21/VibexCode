import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ clanId: string }> }
) {
    try {
        const { clanId } = await params;

        if (!clanId) {
            return NextResponse.json(
                { message: "Invalid clan ID" },
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

        const clan = clanSnap.data() || {};
        const memberCountSnap = await db
            .collection("clanMembers")
            .where("clanId", "==", clanId)
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
            error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: "Failed to fetch clan data", error: errMessage },
            { status: 500 }
        );
    }
}
