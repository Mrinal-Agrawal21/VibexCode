import { Server as IOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "../../types/next"; // your extended type
import { v4 as uuidv4 } from "uuid";
import connectDB from "../../lib/mongodb";
import Users from "../../models/Users";
import { detectAbuse } from "../../lib/moderation";
import { isValidObjectId } from "mongoose";

export const config = {
  api: {
    bodyParser: false,
  },
};

let io: IOServer | undefined;

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (!res.socket.server.io) {
    console.log("🔌 Initializing Socket.io server...");
    const httpServer = res.socket.server as unknown as HTTPServer;

    io = new IOServer(httpServer, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("🟢 Socket connected:", socket.id);

      socket.on("join", ({ conversationId }) => {
        if (typeof conversationId === "string") {
          socket.join(conversationId);
          console.log(`👥 ${socket.id} joined room ${conversationId}`);
        }
      });

      socket.on("leave", ({ conversationId }) => {
        if (typeof conversationId === "string") {
          socket.leave(conversationId);
          console.log(`🚪 ${socket.id} left room ${conversationId}`);
        }
      });

      socket.on("message", async (message) => {
        const { conversationId, senderId, body } = message || {};
        if (typeof conversationId !== "string") {
          console.warn(
            `Received message without valid conversationId from ${socket.id}`
          );
          return;
        }
        if (typeof senderId !== "string" || typeof body !== "string") {
          console.warn(`Received invalid message payload from ${socket.id}`);
          return;
        }

        try {
          await connectDB();
          const userLookup: Array<Record<string, string>> = [
            { firebaseUid: senderId },
            { appwriteId: senderId },
          ];
          if (isValidObjectId(senderId)) {
            userLookup.push({ _id: senderId });
          }

          const user = await Users.findOne({ $or: userLookup }).select(
            "moderation"
          );

          if (!user) return;

          const now = new Date();
          const bannedUntil = user.moderation?.chatBannedUntil;
          if (bannedUntil && bannedUntil > now) return;

          const abuse = detectAbuse(body);
          if (abuse.hit) return;
        } catch (err) {
          console.error("Failed to validate socket message:", err);
          return;
        }

        console.log(`📣 Broadcasting message to room: ${conversationId}`, message);
        io?.to(conversationId).emit("message", {
          ...message,
          _id: message?._id || uuidv4(),
          createdAt: message?.createdAt || new Date().toISOString(),
        });
      });

      socket.on("disconnect", () => {
        console.log(`🔴 Socket disconnected: ${socket.id}`);
      });
    });

    res.socket.server.io = io;
    console.log("✅ Socket.io initialized");
  }

  res.end();
}
