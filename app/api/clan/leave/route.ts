import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const { userEmail } = await request.json();
        const email = normalizeEmail(userEmail);

        if (!email) {
            return NextResponse.json(
                { message: "userEmail is required" },
                { status: 400 }
            );
        }

        const membershipSnap = await db
            .collection("clanMembers")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (membershipSnap.empty) {
            return NextResponse.json(
                { message: "User is not in a clan" },
                { status: 404 }
            );
        }

        const membershipDoc = membershipSnap.docs[0];
        const membership = membershipDoc.data() as { clanId?: string };
        if (!membership.clanId) {
            await membershipDoc.ref.delete();
            return NextResponse.json(
                { message: "User is not in a clan" },
                { status: 404 }
            );
        }

        const clanId = membership.clanId;
        await membershipDoc.ref.delete();

        const clanRef = db.collection("clans").doc(clanId);
        const clanSnap = await clanRef.get();
        if (clanSnap.exists) {
            const clan = clanSnap.data() || {};
            if ((clan.ownerEmail as string) === email) {
                const remainingSnap = await db
                    .collection("clanMembers")
                    .where("clanId", "==", clanId)
                    .get();
                if (remainingSnap.empty) {
                    await clanRef.delete();
                } else {
                    const nextOwner = remainingSnap.docs[0].data().email as string;
                    await clanRef.set(
                        {
                            ownerEmail: nextOwner,
                            updatedAt: FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );
                }
            }
        }

        return NextResponse.json({ message: "Successfully left clan" });
    } catch (error) {
        const errMessage =
            error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: "Failed to leave clan", error: errMessage },
            { status: 500 }
        );
    }
}
