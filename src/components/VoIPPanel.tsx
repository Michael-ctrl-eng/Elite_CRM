"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react"
import { io, Socket } from "socket.io-client"

interface VoIPPanelProps {
  onClose: () => void
}

export default function VoIPPanel({ onClose }: VoIPPanelProps) {
  const { data: session } = useSession()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "connected">("idle")
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const currentCallRef = useRef<any>(null)

  // Keep currentCallRef in sync
  useEffect(() => {
    currentCallRef.current = currentCall
  }, [currentCall])

  // Timer functions (defined early to avoid hoisting issues)
  const startCallTimer = useCallback(() => {
    setCallDuration(0)
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }, [])

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
      callTimerRef.current = null
    }
  }, [])

  const endCall = useCallback(() => {
    const call = currentCallRef.current
    const sock = socketRef.current
    if (call && sock) {
      const targetId = call.toUserId || call.fromUserId
      sock.emit("hang-up", { targetUserId: targetId, callId: call.callId })
    }

    localStreamRef.current?.getTracks().forEach(t => t.stop())
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current = null
    remoteStreamRef.current = null

    setCallState("idle")
    setCurrentCall(null)
    setIsMuted(false)
    setIsDeafened(false)
    setCallDuration(0)
    stopCallTimer()
  }, [stopCallTimer])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  // Fetch online users
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/presence")
        if (res.ok) {
          const users = await res.json()
          setOnlineUsers(users.filter((u: any) => u.id !== (session?.user as any)?.id))
        }
      } catch (e) {}
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 10000)
    return () => clearInterval(interval)
  }, [session])

  // Connect to socket for VoIP signaling
  useEffect(() => {
    const newSocket = io("/?XTransformPort=3003", { transports: ["websocket"] })
    socketRef.current = newSocket

    newSocket.on("connect", () => {
      if (session?.user) {
        newSocket.emit("auth", {
          userId: (session.user as any).id,
          name: session.user.name || "User",
          role: (session.user as any).globalRole,
        })
      }
    })

    // Incoming call
    newSocket.on("incoming-call", async (data: any) => {
      setCallState("ringing")
      setCurrentCall({ callId: data.callId, fromUserId: data.fromUserId, fromUserName: data.fromUserName, offer: data.offer })
    })

    // Call answered
    newSocket.on("call-answered", async (data: any) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
          setCallState("connected")
          startCallTimer()
        } catch (e) { console.error("Set remote answer error:", e) }
      }
    })

    // ICE candidate
    newSocket.on("ice-candidate", async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (e) { console.error("Add ICE candidate error:", e) }
      }
    })

    // Call ended
    newSocket.on("call-ended", () => {
      endCall()
    })

    setSocket(newSocket)
    return () => { newSocket.close() }
  }, [session, startCallTimer, endCall])

  const createPeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ]
    }
    const pc = new RTCPeerConnection(config)

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && currentCallRef.current) {
        socketRef.current.emit("ice-candidate", {
          targetUserId: currentCallRef.current.toUserId || currentCallRef.current.fromUserId,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      if (audioRef.current && event.streams[0]) {
        audioRef.current.srcObject = event.streams[0]
        remoteStreamRef.current = event.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall()
      }
    }

    peerConnectionRef.current = pc
    return pc
  }, [endCall])

  const startCall = async (targetUserId: string, targetUserName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const callId = `call-${Date.now()}`
      setCurrentCall({ callId, toUserId: targetUserId, toUserName: targetUserName })
      setCallState("calling")

      socketRef.current?.emit("call-user", { targetUserId, offer, callId })
    } catch (e) {
      console.error("Start call error:", e)
      alert("Could not access microphone. Please allow microphone permissions.")
    }
  }

  const answerCall = async () => {
    if (!currentCall?.offer) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      await pc.setRemoteDescription(new RTCSessionDescription(currentCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      socketRef.current?.emit("answer-call", {
        targetUserId: currentCall.fromUserId,
        answer,
        callId: currentCall.callId,
      })

      setCallState("connected")
      startCallTimer()
    } catch (e) {
      console.error("Answer call error:", e)
      alert("Could not access microphone.")
    }
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted })
      setIsMuted(!isMuted)
    }
  }

  const toggleDeafen = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isDeafened
      setIsDeafened(!isDeafened)
    }
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Phone size={16} /> VoIP
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <audio ref={audioRef} autoPlay />

      {/* Active Call */}
      {callState !== "idle" && (
        <div className="p-4 border-b border-border bg-primary/5">
          <div className="text-center mb-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Phone size={20} className="text-primary" />
            </div>
            <p className="font-medium text-foreground">
              {callState === "calling" && `Calling ${currentCall?.toUserName}...`}
              {callState === "ringing" && `Incoming from ${currentCall?.fromUserName}`}
              {callState === "connected" && `In call with ${currentCall?.toUserName || currentCall?.fromUserName}`}
            </p>
            {callState === "connected" && (
              <p className="text-sm text-muted-foreground">{formatDuration(callDuration)}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            {callState === "ringing" && (
              <Button onClick={answerCall} size="sm" className="bg-green-500 hover:bg-green-600">
                <Phone size={14} /> Answer
              </Button>
            )}
            {callState === "connected" && (
              <>
                <Button onClick={toggleMute} size="sm" variant={isMuted ? "destructive" : "outline"}>
                  {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </Button>
                <Button onClick={toggleDeafen} size="sm" variant={isDeafened ? "destructive" : "outline"}>
                  {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </Button>
              </>
            )}
            <Button onClick={endCall} size="sm" variant="destructive">
              <PhoneOff size={14} /> End
            </Button>
          </div>
        </div>
      )}

      {/* Online Users */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Online Users ({onlineUsers.length})</p>
        <div className="space-y-2">
          {onlineUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No other users online</p>
          )}
          {onlineUsers.map((user: any) => (
            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center">
                  <span className="text-background text-xs font-bold">{(user.name || "U").charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{user.name || user.email}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => startCall(user.id, user.name || user.email)}
                disabled={callState !== "idle"}>
                <Phone size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
