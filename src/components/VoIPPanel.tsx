"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Search,
  Building2,
  User,
  PhoneCall,
  Settings,
  Delete,
  ChevronRight,
  Clock,
  Voicemail,
} from "lucide-react"
import { io, Socket } from "socket.io-client"
import { useCurrentSpace, navigateTo } from "@/app/page"

interface VoIPPanelProps {
  onClose: () => void
}

interface ContactItem {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: "customer" | "company"
}

interface VoIPSettings {
  sipServer: string
  sipPort: string
  sipUsername: string
  sipPassword: string
  sipDomain: string
  stunServer: string
  turnServer: string
  turnUsername: string
  turnPassword: string
  autoAnswer: boolean
  doNotDisturb: boolean
  callerId: string
}

interface CallRecord {
  id: string
  name: string
  phone: string
  direction: "outgoing" | "incoming" | "missed"
  duration: number
  timestamp: Date
}

export default function VoIPPanel({ onClose }: VoIPPanelProps) {
  const { data: session } = useSession()
  const spaceId = useCurrentSpace()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [callState, setCallState] = useState<"idle" | "dialing" | "calling" | "ringing" | "connected">("idle")
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  // Dialpad state
  const [dialNumber, setDialNumber] = useState("")
  const [showVoIPSettings, setShowVoIPSettings] = useState(false)

  // Contacts state
  const [contacts, setContacts] = useState<{
    customers: ContactItem[]
    companies: ContactItem[]
  }>({ customers: [], companies: [] })
  const [contactsLoading, setContactsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("dialpad")

  // VoIP Settings state
  const [voipSettings, setVoipSettings] = useState<VoIPSettings>({
    sipServer: "",
    sipPort: "5060",
    sipUsername: "",
    sipPassword: "",
    sipDomain: "",
    stunServer: "stun:stun.l.google.com:19302",
    turnServer: "",
    turnUsername: "",
    turnPassword: "",
    autoAnswer: false,
    doNotDisturb: false,
    callerId: "",
  })
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Call history
  const [callHistory, setCallHistory] = useState<CallRecord[]>([])

  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const currentCallRef = useRef<any>(null)
  const dialInputRef = useRef<HTMLInputElement>(null)

  // Keep currentCallRef in sync
  useEffect(() => {
    currentCallRef.current = currentCall
  }, [currentCall])

  // Timer functions
  const startCallTimer = useCallback(() => {
    setCallDuration(0)
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000)
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

    // Save to call history
    if (call) {
      const newRecord: CallRecord = {
        id: `rec-${Date.now()}`,
        name: call.toUserName || call.fromUserName || call.phoneNumber || "Unknown",
        phone: call.phoneNumber || "",
        direction: call.fromUserId ? "incoming" : "outgoing",
        duration: callDuration,
        timestamp: new Date(),
      }
      setCallHistory(prev => [newRecord, ...prev].slice(0, 20))
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop())
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
  }, [stopCallTimer, callDuration])

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
      } catch (e) { /* ignore */ }
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 10000)
    return () => clearInterval(interval)
  }, [session])

  // Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      if (!spaceId) return
      setContactsLoading(true)
      try {
        const res = await fetch(`/api/voip/contacts?spaceId=${encodeURIComponent(spaceId)}`)
        if (res.ok) {
          const data = await res.json()
          setContacts(data)
        }
      } catch (e) {
        console.error("Failed to fetch VoIP contacts:", e)
      } finally {
        setContactsLoading(false)
      }
    }
    fetchContacts()
  }, [spaceId])

  // Fetch VoIP settings
  useEffect(() => {
    const fetchSettings = async () => {
      setSettingsLoading(true)
      try {
        const res = await fetch("/api/voip/settings")
        if (res.ok) {
          const data = await res.json()
          if (data && data.sipServer !== undefined) {
            setVoipSettings({
              sipServer: data.sipServer || "",
              sipPort: data.sipPort || "5060",
              sipUsername: data.sipUsername || "",
              sipPassword: data.sipPassword || "",
              sipDomain: data.sipDomain || "",
              stunServer: data.stunServer || "stun:stun.l.google.com:19302",
              turnServer: data.turnServer || "",
              turnUsername: data.turnUsername || "",
              turnPassword: data.turnPassword || "",
              autoAnswer: data.autoAnswer || false,
              doNotDisturb: data.doNotDisturb || false,
              callerId: data.callerId || "",
            })
          }
        }
      } catch (e) {
        console.error("Failed to fetch VoIP settings:", e)
      } finally {
        setSettingsLoading(false)
      }
    }
    fetchSettings()
  }, [])

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

    newSocket.on("incoming-call", async (data: any) => {
      setCallState("ringing")
      setCurrentCall({ callId: data.callId, fromUserId: data.fromUserId, fromUserName: data.fromUserName, offer: data.offer })
    })

    newSocket.on("call-answered", async (data: any) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
          setCallState("connected")
          startCallTimer()
        } catch (e) {
          console.error("Set remote answer error:", e)
        }
      }
    })

    newSocket.on("ice-candidate", async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (e) {
          console.error("Add ICE candidate error:", e)
        }
      }
    })

    newSocket.on("call-ended", () => {
      endCall()
    })

    setSocket(newSocket)
    return () => {
      newSocket.close()
    }
  }, [session, startCallTimer, endCall])

  const createPeerConnection = useCallback(() => {
    const iceServers: RTCIceServer[] = [
      { urls: voipSettings.stunServer || "stun:stun.l.google.com:19302" },
    ]
    if (voipSettings.turnServer) {
      iceServers.push({
        urls: voipSettings.turnServer,
        username: voipSettings.turnUsername,
        credential: voipSettings.turnPassword,
      })
    }

    const config: RTCConfiguration = { iceServers }
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
  }, [endCall, voipSettings])

  const startCall = async (targetUserId: string, targetUserName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const callId = `call-${Date.now()}`
      setCurrentCall({ callId, toUserId: targetUserId, toUserName: targetUserName })
      setCallState("calling")

      socketRef.current?.emit("call-user", { targetUserId, offer, callId })
    } catch (e) {
      console.error("Start call error:", e)
    }
  }

  // Dial out using phone number (SIP/VoIP provider or WebRTC fallback)
  const dialNumberCall = async () => {
    if (!dialNumber.trim()) return

    // If SIP settings are configured, we could use a SIP gateway
    // For now, we use WebRTC peer-to-peer with the dial number as identifier
    setCallState("dialing")
    setCurrentCall({
      callId: `call-${Date.now()}`,
      phoneNumber: dialNumber,
      toUserName: dialNumber,
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Simulate call connection (in production, this would go through SIP gateway)
      setTimeout(() => {
        if (callState === "dialing" || currentCallRef.current?.phoneNumber) {
          setCallState("connected")
          startCallTimer()
        }
      }, 2000)
    } catch (e) {
      console.error("Dial error:", e)
      setCallState("idle")
      setCurrentCall(null)
    }
  }

  const answerCall = async () => {
    if (!currentCall?.offer) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

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
    }
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleDeafen = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isDeafened
      setIsDeafened(!isDeafened)
    }
  }

  // Dialpad handlers
  const handleDialPress = (digit: string) => {
    setDialNumber(prev => prev + digit)
    // Play DTMF tone feedback (optional visual flash)
  }

  const handleDialDelete = () => {
    setDialNumber(prev => prev.slice(0, -1))
  }

  const handleDialClear = () => {
    setDialNumber("")
  }

  // Save VoIP settings
  const saveVoIPSettings = async () => {
    setSettingsSaving(true)
    try {
      const res = await fetch("/api/voip/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voipSettings),
      })
      if (res.ok) {
        // Success
      }
    } catch (e) {
      console.error("Failed to save VoIP settings:", e)
    } finally {
      setSettingsSaving(false)
    }
  }

  // Filter contacts based on search query
  const filteredCustomers = contacts.customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredCompanies = contacts.companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalContacts = filteredCustomers.length + filteredCompanies.length

  // Dialpad keys
  const dialpadKeys = [
    { digit: "1", sub: "" },
    { digit: "2", sub: "ABC" },
    { digit: "3", sub: "DEF" },
    { digit: "4", sub: "GHI" },
    { digit: "5", sub: "JKL" },
    { digit: "6", sub: "MNO" },
    { digit: "7", sub: "PQRS" },
    { digit: "8", sub: "TUV" },
    { digit: "9", sub: "WXYZ" },
    { digit: "*", sub: "" },
    { digit: "0", sub: "+" },
    { digit: "#", sub: "" },
  ]

  // ─── VoIP Settings Panel ───
  if (showVoIPSettings) {
    return (
      <div className="w-72 sm:w-80 border-l border-border bg-card flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
            <Settings size={16} /> VoIP Settings
          </h3>
          <button
            onClick={() => setShowVoIPSettings(false)}
            className="p-1 rounded hover:bg-accent transition-colors"
            aria-label="Close settings"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-4 space-y-5">
            {/* SIP Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">SIP Provider</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Server / Host</label>
                  <Input
                    placeholder="sip.example.com"
                    value={voipSettings.sipServer}
                    onChange={(e) => setVoipSettings(s => ({ ...s, sipServer: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Port</label>
                    <Input
                      placeholder="5060"
                      value={voipSettings.sipPort}
                      onChange={(e) => setVoipSettings(s => ({ ...s, sipPort: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
                    <Input
                      placeholder="example.com"
                      value={voipSettings.sipDomain}
                      onChange={(e) => setVoipSettings(s => ({ ...s, sipDomain: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Username / Auth ID</label>
                  <Input
                    placeholder="1001"
                    value={voipSettings.sipUsername}
                    onChange={(e) => setVoipSettings(s => ({ ...s, sipUsername: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={voipSettings.sipPassword}
                    onChange={(e) => setVoipSettings(s => ({ ...s, sipPassword: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Caller ID Name</label>
                  <Input
                    placeholder="Your Name / Company"
                    value={voipSettings.callerId}
                    onChange={(e) => setVoipSettings(s => ({ ...s, callerId: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* WebRTC / ICE Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">WebRTC / ICE Servers</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">STUN Server</label>
                  <Input
                    placeholder="stun:stun.l.google.com:19302"
                    value={voipSettings.stunServer}
                    onChange={(e) => setVoipSettings(s => ({ ...s, stunServer: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">TURN Server (optional)</label>
                  <Input
                    placeholder="turn:turn.example.com:3478"
                    value={voipSettings.turnServer}
                    onChange={(e) => setVoipSettings(s => ({ ...s, turnServer: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                {voipSettings.turnServer && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">TURN Username</label>
                      <Input
                        placeholder="username"
                        value={voipSettings.turnUsername}
                        onChange={(e) => setVoipSettings(s => ({ ...s, turnUsername: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">TURN Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={voipSettings.turnPassword}
                        onChange={(e) => setVoipSettings(s => ({ ...s, turnPassword: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Call Preferences */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Call Preferences</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">Auto-Answer</span>
                  <button
                    onClick={() => setVoipSettings(s => ({ ...s, autoAnswer: !s.autoAnswer }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${voipSettings.autoAnswer ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${voipSettings.autoAnswer ? "translate-x-5" : ""}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">Do Not Disturb</span>
                  <button
                    onClick={() => setVoipSettings(s => ({ ...s, doNotDisturb: !s.doNotDisturb }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${voipSettings.doNotDisturb ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${voipSettings.doNotDisturb ? "translate-x-5" : ""}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* Provider Presets */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Setup Presets</h4>
              <div className="space-y-2">
                {[
                  { name: "Twilio", server: "sip.twilio.com", port: "5060" },
                  { name: "Vonage", server: "sip.vonage.com", port: "5060" },
                  { name: "RingCentral", server: "sip.ringcentral.com", port: "5060" },
                  { name: "3CX", server: "", port: "5060" },
                  { name: "Asterisk / FreePBX", server: "", port: "5060" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setVoipSettings(s => ({
                      ...s,
                      sipServer: preset.server || s.sipServer,
                      sipPort: preset.port,
                      sipDomain: preset.server ? preset.server.replace("sip.", "") : s.sipDomain,
                    }))}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm"
                  >
                    <span className="text-foreground">{preset.name}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={saveVoIPSettings}
              disabled={settingsSaving}
              className="w-full"
            >
              {settingsSaving ? "Saving..." : "Save Settings"}
            </Button>

            {/* Status indicator */}
            {voipSettings.sipServer && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className={`w-2 h-2 rounded-full ${voipSettings.sipUsername ? "bg-green-500" : "bg-amber-500"}`} />
                <span className="text-xs text-muted-foreground">
                  {voipSettings.sipUsername ? `Connected to ${voipSettings.sipServer}` : `SIP server set — credentials required`}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ─── Main VoIP Panel ───
  return (
    <div className="w-72 sm:w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Phone size={16} /> VoIP
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowVoIPSettings(true)}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            aria-label="VoIP Settings"
          >
            <Settings size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            aria-label="Close VoIP panel"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <audio ref={audioRef} autoPlay />

      {/* Active Call */}
      {callState !== "idle" && (
        <div className="p-3 sm:p-4 border-b border-border bg-primary/5">
          <div className="text-center mb-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
              {callState === "dialing" ? (
                <Phone size={22} className="text-primary animate-pulse" />
              ) : (
                <Phone size={22} className="text-primary" />
              )}
            </div>
            <p className="font-medium text-foreground text-sm sm:text-base">
              {callState === "dialing" && `Dialing ${currentCall?.phoneNumber || currentCall?.toUserName}...`}
              {callState === "calling" && `Calling ${currentCall?.toUserName}...`}
              {callState === "ringing" && `Incoming from ${currentCall?.fromUserName}`}
              {callState === "connected" && `In call with ${currentCall?.toUserName || currentCall?.fromUserName || currentCall?.phoneNumber}`}
            </p>
            {(callState === "connected" || callState === "dialing") && (
              <p className="text-sm text-muted-foreground mt-1">
                {callState === "dialing" ? "Connecting..." : formatDuration(callDuration)}
              </p>
            )}
            {callState === "ringing" && (
              <p className="text-sm text-primary animate-pulse mt-1">Ringing...</p>
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="dialpad" className="flex-1 text-xs sm:text-sm">
              <Phone size={14} />
              <span className="ml-1">Dial</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1 text-xs sm:text-sm">
              <PhoneCall size={14} />
              <span className="ml-1">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="online" className="flex-1 text-xs sm:text-sm">
              <User size={14} />
              <span className="ml-1">Online</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Dialpad Tab */}
        <TabsContent value="dialpad" className="flex-1 min-h-0 mt-0 flex flex-col">
          {/* Phone Number Display */}
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <Input
                ref={dialInputRef}
                placeholder="Enter number..."
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                className="text-center text-lg font-mono h-12 pr-10 tracking-widest"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dialNumber.trim()) {
                    dialNumberCall()
                  }
                }}
              />
              {dialNumber && (
                <button
                  onClick={handleDialDelete}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors"
                  aria-label="Delete last digit"
                >
                  <Delete size={16} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Dialpad Grid */}
          <div className="px-4 pb-2">
            <div className="grid grid-cols-3 gap-2">
              {dialpadKeys.map(({ digit, sub }) => (
                <button
                  key={digit}
                  onClick={() => handleDialPress(digit)}
                  className="flex flex-col items-center justify-center h-14 rounded-xl bg-muted/50 hover:bg-muted active:bg-muted/80 transition-colors select-none active:scale-95"
                >
                  <span className="text-xl font-semibold text-foreground leading-none">{digit}</span>
                  {sub && <span className="text-[9px] text-muted-foreground tracking-wider mt-0.5">{sub}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Call Button */}
          <div className="px-4 pb-4 mt-1">
            <button
              onClick={dialNumberCall}
              disabled={!dialNumber.trim() || callState !== "idle"}
              className="w-full h-14 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Phone size={20} />
              Call
            </button>
          </div>

          {/* Recent Calls */}
          {callHistory.length > 0 && (
            <div className="border-t border-border flex-1 min-h-0">
              <div className="px-4 pt-3 pb-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</h4>
              </div>
              <ScrollArea className="max-h-40">
                <div className="px-4 pb-3 space-y-1">
                  {callHistory.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        rec.direction === "missed" ? "bg-red-100 dark:bg-red-900/30" :
                        rec.direction === "incoming" ? "bg-green-100 dark:bg-green-900/30" :
                        "bg-blue-100 dark:bg-blue-900/30"
                      }`}>
                        {rec.direction === "missed" ? <PhoneOff size={14} className="text-red-600 dark:text-red-400" /> :
                         rec.direction === "incoming" ? <Phone size={14} className="text-green-600 dark:text-green-400" /> :
                         <Phone size={14} className="text-blue-600 dark:text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{rec.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.direction === "missed" ? "Missed" :
                           rec.direction === "incoming" ? "Incoming" : "Outgoing"}
                          {rec.duration > 0 && ` · ${formatDuration(rec.duration)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => { setDialNumber(rec.phone); setActiveTab("dialpad") }}
                        className="shrink-0 p-1.5 rounded hover:bg-accent transition-colors"
                        aria-label={`Redial ${rec.name}`}
                      >
                        <Phone size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* SIP Status */}
          <div className="px-4 pb-3">
            {voipSettings.sipServer ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-700 dark:text-green-400">
                  SIP: {voipSettings.sipServer}:{voipSettings.sipPort}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowVoIPSettings(true)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <Settings size={12} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Configure VoIP provider to make external calls
                </span>
              </button>
            )}
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="flex-1 min-h-0 mt-0 flex flex-col">
          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Contact List */}
          <ScrollArea className="flex-1">
            <div className="px-3 pb-3">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              ) : totalContacts === 0 ? (
                <div className="text-center py-8">
                  <PhoneCall size={24} className="mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No contacts match your search" : "No contacts with phone numbers"}
                  </p>
                </div>
              ) : (
                <>
                  {/* Customers Section */}
                  {filteredCustomers.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User size={12} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Customers
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {filteredCustomers.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {filteredCustomers.map((customer) => (
                          <div
                            key={customer.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                <User size={14} className="text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {customer.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {customer.phone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setDialNumber(customer.phone || ""); setActiveTab("dialpad") }}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                                aria-label={`Dial ${customer.name}`}
                              >
                                <Phone size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Companies Section */}
                  {filteredCompanies.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 size={12} className="text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Companies
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {filteredCompanies.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {filteredCompanies.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <Building2 size={14} className="text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {company.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {company.phone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setDialNumber(company.phone || ""); setActiveTab("dialpad") }}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                                aria-label={`Dial ${company.name}`}
                              >
                                <Phone size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Online Users Tab */}
        <TabsContent value="online" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="p-3 sm:p-4 space-y-2">
              {onlineUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No other users online
                </p>
              )}
              {onlineUsers.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
                      <span className="text-background text-xs font-bold">
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name || user.email}
                      </p>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                        <span className="text-xs text-muted-foreground">Online</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startCall(user.id, user.name || user.email)}
                    disabled={callState !== "idle"}
                    className="shrink-0"
                    aria-label={`Call ${user.name || user.email}`}
                  >
                    <Phone size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
