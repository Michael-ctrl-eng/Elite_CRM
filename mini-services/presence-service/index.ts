import { Server as HttpServer } from "http"
import { Server as SocketIOServer } from "socket.io"

const PORT = 3003

const httpServer = new HttpServer()
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
})

// In-memory presence store
const presence = new Map<string, {
  socketId: string
  userId: string
  name: string
  spaceId: string | null
  role: string
  status: "online" | "offline" | "away"
  lastSeen: number
}>()

// Active calls tracking
const activeCalls = new Map<string, {
  callId: string
  fromUserId: string
  toUserId: string
  startTime: number
}>()

// Heartbeat check interval
const HEARTBEAT_TIMEOUT = 60000 // 60 seconds

io.on("connection", (socket) => {
  console.log(`[Presence] Client connected: ${socket.id}`)

  // Authenticate user
  socket.on("auth", (data: { userId: string; name: string; spaceId?: string; role: string }) => {
    presence.set(data.userId, {
      socketId: socket.id,
      userId: data.userId,
      name: data.name,
      spaceId: data.spaceId || null,
      role: data.role,
      status: "online",
      lastSeen: Date.now(),
    })

    // Join user's personal room for direct messages/calls
    socket.join(`user:${data.userId}`)

    // Join space room
    if (data.spaceId) {
      socket.join(`space:${data.spaceId}`)
    }

    // Join superadmin room if superadmin
    if (data.role === "superadmin") {
      socket.join("superadmin")
    }

    // Broadcast presence update
    const presenceData = { userId: data.userId, name: data.name, status: "online", spaceId: data.spaceId }
    if (data.spaceId) {
      socket.to(`space:${data.spaceId}`).emit("presence-update", presenceData)
    }
    io.to("superadmin").emit("presence-update", presenceData)

    // Send current online users to the connecting user
    const onlineInSpace = Array.from(presence.values())
      .filter(p => p.spaceId === data.spaceId && p.status === "online" && p.userId !== data.userId)
      .map(p => ({ userId: p.userId, name: p.name, status: p.status, spaceId: p.spaceId }))
    socket.emit("online-users", onlineInSpace)

    console.log(`[Presence] User ${data.name} (${data.userId}) authenticated, space: ${data.spaceId}`)
  })

  // Heartbeat
  socket.on("heartbeat", () => {
    const entry = Array.from(presence.values()).find(p => p.socketId === socket.id)
    if (entry) {
      entry.lastSeen = Date.now()
      entry.status = "online"
    }
  })

  // Switch space
  socket.on("set-space", (data: { spaceId: string }) => {
    const entry = Array.from(presence.values()).find(p => p.socketId === socket.id)
    if (entry) {
      // Leave old space room
      if (entry.spaceId) {
        socket.leave(`space:${entry.spaceId}`)
        socket.to(`space:${entry.spaceId}`).emit("user-left-space", { userId: entry.userId, spaceId: entry.spaceId })
      }
      // Join new space room
      entry.spaceId = data.spaceId
      socket.join(`space:${data.spaceId}`)
      socket.to(`space:${data.spaceId}`).emit("user-joined-space", { userId: entry.userId, name: entry.name, spaceId: data.spaceId })

      // Send online users in new space
      const onlineInSpace = Array.from(presence.values())
        .filter(p => p.spaceId === data.spaceId && p.status === "online" && p.userId !== entry.userId)
        .map(p => ({ userId: p.userId, name: p.name, status: p.status, spaceId: p.spaceId }))
      socket.emit("online-users", onlineInSpace)
    }
  })

  // VoIP Signaling - Call user
  socket.on("call-user", (data: { targetUserId: string; offer: any; callId: string }) => {
    const caller = Array.from(presence.values()).find(p => p.socketId === socket.id)
    if (!caller) return

    activeCalls.set(data.callId, {
      callId: data.callId,
      fromUserId: caller.userId,
      toUserId: data.targetUserId,
      startTime: Date.now(),
    })

    io.to(`user:${data.targetUserId}`).emit("incoming-call", {
      fromUserId: caller.userId,
      fromUserName: caller.name,
      callId: data.callId,
      offer: data.offer,
    })
  })

  // VoIP Signaling - Answer call
  socket.on("answer-call", (data: { targetUserId: string; answer: any; callId: string }) => {
    io.to(`user:${data.targetUserId}`).emit("call-answered", {
      callId: data.callId,
      answer: data.answer,
    })
  })

  // VoIP Signaling - ICE candidate
  socket.on("ice-candidate", (data: { targetUserId: string; candidate: any }) => {
    io.to(`user:${data.targetUserId}`).emit("ice-candidate", {
      candidate: data.candidate,
      fromUserId: Array.from(presence.values()).find(p => p.socketId === socket.id)?.userId,
    })
  })

  // VoIP Signaling - Hang up
  socket.on("hang-up", (data: { targetUserId: string; callId: string }) => {
    io.to(`user:${data.targetUserId}`).emit("call-ended", { callId: data.callId })
    activeCalls.delete(data.callId)
  })

  // Activity event broadcast
  socket.on("activity-event", (data: { spaceId: string; action: string; entity: string; details: string; userId: string }) => {
    socket.to(`space:${data.spaceId}`).emit("activity-feed", {
      ...data,
      timestamp: Date.now(),
    })
    // Also send to superadmins
    io.to("superadmin").emit("activity-feed", {
      ...data,
      timestamp: Date.now(),
    })
  })

  // Disconnect
  socket.on("disconnect", () => {
    const entry = Array.from(presence.values()).find(p => p.socketId === socket.id)
    if (entry) {
      entry.status = "offline"
      if (entry.spaceId) {
        socket.to(`space:${entry.spaceId}`).emit("presence-update", {
          userId: entry.userId,
          name: entry.name,
          status: "offline",
          spaceId: entry.spaceId,
        })
      }
      io.to("superadmin").emit("presence-update", {
        userId: entry.userId,
        name: entry.name,
        status: "offline",
        spaceId: entry.spaceId,
      })
      // Remove after 5 min
      setTimeout(() => {
        if (presence.get(entry.userId)?.lastSeen === entry.lastSeen) {
          presence.delete(entry.userId)
        }
      }, 300000)
    }
    console.log(`[Presence] Client disconnected: ${socket.id}`)
  })
})

// Periodic heartbeat check - mark users offline if no ping
setInterval(() => {
  const now = Date.now()
  for (const [userId, data] of presence) {
    if (now - data.lastSeen > HEARTBEAT_TIMEOUT && data.status === "online") {
      data.status = "away"
      if (data.spaceId) {
        io.to(`space:${data.spaceId}`).emit("presence-update", {
          userId: data.userId,
          name: data.name,
          status: "away",
          spaceId: data.spaceId,
        })
      }
    }
  }
}, 30000)

// SuperAdmin stats broadcast every 5 seconds
setInterval(() => {
  const onlineCount = Array.from(presence.values()).filter(p => p.status === "online").length
  const activeSpaces = new Set(Array.from(presence.values()).filter(p => p.spaceId).map(p => p.spaceId)).size
  const activeCallCount = activeCalls.size

  io.to("superadmin").emit("superadmin-stats", {
    onlineUsers: onlineCount,
    activeSpaces,
    activeCalls: activeCallCount,
    totalConnected: presence.size,
    timestamp: Date.now(),
  })
}, 5000)

httpServer.listen(PORT, () => {
  console.log(`[Elite Presence Service] Running on port ${PORT}`)
})
