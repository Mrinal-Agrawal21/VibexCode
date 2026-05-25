import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { normalizeEmail } from "@/lib/firestore-helpers";

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { message: "Email and password are required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { message: "Missing Firebase API key" },
                { status: 500 }
            );
        }

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return NextResponse.json({ message: "Invalid email" }, { status: 400 });
        }

        const authResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: normalizedEmail,
                    password,
                    returnSecureToken: true,
                }),
            }
        );

        if (!authResponse.ok) {
            return NextResponse.json(
                { message: "Invalid email or password" },
                { status: 401 }
            );
        }

        const authData = (await authResponse.json()) as {
            localId: string;
            idToken: string;
            email: string;
            displayName?: string;
        };

        const users = db.collection("users");
        let userDoc = await users.doc(authData.localId).get();
        if (!userDoc.exists) {
            const byEmail = await users
                .where("email", "==", normalizedEmail)
                .limit(1)
                .get();
            if (!byEmail.empty) {
                userDoc = byEmail.docs[0];
                await userDoc.ref.set(
                    { firebaseUid: authData.localId, updatedAt: FieldValue.serverTimestamp() },
                    { merge: true }
                );
            } else {
                const username =
                    typeof authData.displayName === "string" && authData.displayName.trim()
                        ? authData.displayName.trim()
                        : normalizedEmail.split("@")[0];
                await users.doc(authData.localId).set({
                    email: normalizedEmail,
                    username,
                    name: username,
                    firebaseUid: authData.localId,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                userDoc = await users.doc(authData.localId).get();
            }
        }

        const userData = userDoc.data() || {};

        const response = NextResponse.json(
            {
                message: "Login successful",
                user: {
                    email: (userData.email as string) || normalizedEmail,
                    username:
                        (userData.username as string) || normalizedEmail.split("@")[0],
                },
            },
            { status: 200 }
        );

        response.cookies.set("token", authData.idToken, {
            path: "/",
            httpOnly: false,
            maxAge: 60 * 60 * 24,
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { message: "Internal Server Error" },
            { status: 500 }
        );
    }
}
