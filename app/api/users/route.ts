// app/api/users/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snapshot = await db.collection("users").get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || "",
        username: data.username || "",
      };
    });

    return new NextResponse(JSON.stringify({ users }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
