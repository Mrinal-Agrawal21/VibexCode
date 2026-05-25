// POST   /api/follow                            — follow a user
//   body: { followerEmail, followingEmail }
// DELETE /api/follow                            — unfollow a user
//   body: { followerEmail, followingEmail }
// GET    /api/follow?userEmail=foo@bar.com      — list a user's followers + following
//   returns: { followers: string[], following: string[], counts: { followers, following } }
//
// SECURITY: see lib/auth.ts. followerEmail is client-supplied and could
// be spoofed until we add server-verified auth tokens.

import { NextRequest, NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

export const runtime = "nodejs";

function normalize(email: unknown): string | null {
    if (typeof email !== "string") return null;
    const v = email.trim().toLowerCase();
    return v.length > 0 ? v : null;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const follower = normalize(body?.followerEmail);
        const following = normalize(body?.followingEmail);

        if (!follower || !following) {
            return NextResponse.json(
                { success: false, error: "followerEmail and followingEmail are required" },
                { status: 400 }
            );
        }
        if (follower === following) {
            return NextResponse.json(
                { success: false, error: "Cannot follow yourself" },
                { status: 400 }
            );
        }

        const docId = `${follower}__${following}`;
        const ref = db.collection("follows").doc(docId);
        const existing = await ref.get();
        if (existing.exists) {
            return NextResponse.json({
                success: true,
                message: "Already following",
            });
        }

        await ref.set({
            followerEmail: follower,
            followingEmail: following,
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to follow";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const follower = normalize(body?.followerEmail);
        const following = normalize(body?.followingEmail);

        if (!follower || !following) {
            return NextResponse.json(
                { success: false, error: "followerEmail and followingEmail are required" },
                { status: 400 }
            );
        }

        const docId = `${follower}__${following}`;
        await db.collection("follows").doc(docId).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to unfollow";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userEmail = normalize(searchParams.get("userEmail"));

        if (!userEmail) {
            return NextResponse.json(
                { success: false, error: "userEmail is required" },
                { status: 400 }
            );
        }

        const [followersSnap, followingSnap] = await Promise.all([
            db
                .collection("follows")
                .where("followingEmail", "==", userEmail)
                .get(),
            db
                .collection("follows")
                .where("followerEmail", "==", userEmail)
                .get(),
        ]);

        const followers = followersSnap.docs.map(
            (doc: any) => (doc.data().followerEmail as string) || ""
        );
        const following = followingSnap.docs.map(
            (doc: any) => (doc.data().followingEmail as string) || ""
        );

        return NextResponse.json({
            success: true,
            followers,
            following,
            counts: {
                followers: followers.length,
                following: following.length,
            },
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to fetch follows";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
