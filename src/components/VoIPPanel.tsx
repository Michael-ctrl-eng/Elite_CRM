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
  Pause,
  Play,
  PhoneForwarded,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { io, Socket } from "socket.io-client"
import { useCurrentSpace } from "@/app/page"

// ─── Types ───

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
  wsPort: string
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
  timestamp: Date | string
}

type SipConnectionState = "disconnected" | "connecting" | "registering" | "registered" | "error"
type CallState = "idle" | "dialing" | "calling" | "ringing" | "connected" | "held"

// SIP.js types (dynamically imported, so we use any for refs)
interface SipUa { stop(): Promise<void>; start(): Promise<void> }
interface SipRegisterer { register(): Promise<void>; unregister(): Promise<void>; state: { status: string } }
interface SipInviter { invite(): Promise<void>; cancel(): Promise<void> }
interface SipInvitation { accept(options?: any): Promise<void>; reject(): Promise<void> }
interface SipSession { state: { state: string }; hold(): Promise<void>; unhold(): Promise<void>; bye(): Promise<void>; info(options: any): Promise<void>; refer(referrer: any): Promise<void> }

// ─── SIP Manager (client-side only) ───

class SipManager {
  private ua: SipUa | null = null
  private registerer: SipRegisterer | null = null
  private activeSession: SipSession | null = null
  private activeInviter: SipInviter | null = null
  private activeInvitation: SipInvitation | null = null
  private sipJsModule: any = null
  private _state: SipConnectionState = "disconnected"
  private onStateChange: (state: SipConnectionState) => void
  private onIncomingCall: (invitation: SipInvitation, from: string) => void
  private onSessionStateChange: (state: string) => void

  constructor(callbacks: {
    onStateChange: (state: SipConnectionState) => void
    onIncomingCall: (invitation: SipInvitation, from: string) => void
    onSessionStateChange: (state: string) => void
  }) {
    this.onStateChange = callbacks.onStateChange
    this.onIncomingCall = callbacks.onIncomingCall
    this.onSessionStateChange = callbacks.onSessionStateChange
  }

  get state() { return this._state }
  get session() { return this.activeSession }

  private setState(s: SipConnectionState) {
    this._state = s
    this.onStateChange(s)
  }

  async loadModule() {
    if (this.sipJsModule) return this.sipJsModule
    this.sipJsModule = await import("sip.js")
    return this.sipJsModule
  }

  async connect(settings: VoIPSettings) {
    // Disconnect any existing connection first
    await this.disconnect()

    if (!settings.sipServer || !settings.sipUsername || !settings.sipDomain) {
      throw new Error("SIP server, username, and domain are required")
    }

    const sipJs = await this.loadModule()
    this.setState("connecting")

    try {
      const wsPort = settings.wsPort || "8089"
      const uri = sipJs.UserAgent.makeURI(`sip:${settings.sipUsername}@${settings.sipDomain}`)
      if (!uri) throw new Error("Invalid SIP URI")

      const transportServer = `wss://${settings.sipServer}:${wsPort}`

      this.ua = new sipJs.UserAgent({
        uri,
        transportOptions: {
          server: transportServer,
        },
        authorizationUsername: settings.sipUsername,
        authorizationPassword: settings.sipPassword,
        delegate: {
          onInvite: (invitation: SipInvitation) => {
            this.activeInvitation = invitation
            this.activeSession = invitation as unknown as SipSession
            const from = (invitation as any).remoteIdentity?.uri?.user || "Unknown"
            this.onIncomingCall(invitation, from)

            // Track session state changes
            ;(invitation as any).stateChange.addListener((state: string) => {
              this.onSessionStateChange(state)
              if (state === "Terminated" || state === "Ended") {
                this.activeSession = null
                this.activeInvitation = null
                this.activeInviter = null
              }
            })
          },
        },
      })

      await this.ua.start()
      this.setState("registering")

      this.registerer = new sipJs.Registerer(this.ua)
      await this.registerer.register()
      this.setState("registered")

      return true
    } catch (e: any) {
      console.error("SIP connect error:", e)
      this.setState("error")
      throw e
    }
  }

  async disconnect() {
    try {
      if (this.activeSession) {
        try { await (this.activeSession as any).bye() } catch { /* ignore */ }
        this.activeSession = null
        this.activeInviter = null
        this.activeInvitation = null
      }
      if (this.registerer) {
        try { await this.registerer.unregister() } catch { /* ignore */ }
        this.registerer = null
      }
      if (this.ua) {
        try { await this.ua.stop() } catch { /* ignore */ }
        this.ua = null
      }
    } catch { /* ignore */ }
    this.setState("disconnected")
  }

  async dial(number: string, domain: string): Promise<SipSession> {
    if (!this.ua) throw new Error("SIP not connected")

    const sipJs = await this.loadModule()
    const target = sipJs.UserAgent.makeURI(`sip:${number}@${domain}`)
    if (!target) throw new Error("Invalid target URI")

    const inviter = new sipJs.Inviter(this.ua, target)
    this.activeInviter = inviter
    this.activeSession = inviter as unknown as SipSession

    // Track session state
    ;(inviter as any).stateChange.addListener((state: string) => {
      this.onSessionStateChange(state)
      if (state === "Terminated" || state === "Ended") {
        this.activeSession = null
        this.activeInviter = null
        this.activeInvitation = null
      }
    })

    await inviter.invite()
    return this.activeSession
  }

  async answer(invitation?: SipInvitation) {
    const inv = invitation || this.activeInvitation
    if (!inv) throw new Error("No incoming call to answer")

    await inv.accept({
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
      },
    })
    this.activeSession = inv as unknown as SipSession
  }

  async reject(invitation?: SipInvitation) {
    const inv = invitation || this.activeInvitation
    if (!inv) return
    await inv.reject()
    this.activeInvitation = null
    this.activeInvitation = null
    this.activeSession = null
  }

  async hangup() {
    if (this.activeSession) {
      try {
        const state = (this.activeSession as any).state?.state || ""
        if (state === "Established") {
          await (this.activeSession as any).bye()
        } else if (state === "Establishing" || state === "Initial") {
          if (this.activeInviter) {
            await this.activeInviter.cancel()
          } else {
            await (this.activeSession as any).reject()
          }
        }
      } catch { /* ignore */ }
      this.activeSession = null
      this.activeInviter = null
      this.activeInvitation = null
    }
  }

  async hold() {
    if (this.activeSession) {
      await (this.activeSession as any).hold()
    }
  }

  async unhold() {
    if (this.activeSession) {
      await (this.activeSession as any).unhold()
    }
  }

  async sendDtmf(tone: string) {
    if (this.activeSession) {
      const sipJs = await this.loadModule()
      const dtmf = tone === "*" ? "star" : tone === "#" ? "pound" : tone
      try {
        await (this.activeSession as any).info({
          requestOptions: {
            body: {
              contentDisposition: "render",
              contentType: "application/dtmf-relay",
              content: `Signal=${dtmf}\r\nDuration=250`,
            },
          },
        })
      } catch (e) {
        console.error("DTMF send error:", e)
      }
    }
  }

  async blindTransfer(target: string, domain: string) {
    if (!this.activeSession) throw new Error("No active call to transfer")
    const sipJs = await this.loadModule()
    const targetUri = sipJs.UserAgent.makeURI(`sip:${target}@${domain}`)
    if (!targetUri) throw new Error("Invalid transfer target URI")
    await (this.activeSession as any).refer(targetUri)
  }
}

// ─── Component ───

export default function VoIPPanel({ onClose }: VoIPPanelProps) {
  const { data: session } = useSession()
  const spaceId = useCurrentSpace()

  // Online users & socket
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  // Call state
  const [callState, setCallState] = useState<CallState>("idle")
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)

  // Dialpad state
  const [dialNumber, setDialNumber] = useState("")
  const [showVoIPSettings, setShowVoIPSettings] = useState(false)

  // Transfer dialog
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferNumber, setTransferNumber] = useState("")

  // SIP state
  const [sipState, setSipState] = useState<SipConnectionState>("disconnected")
  const [sipError, setSipError] = useState<string>("")
  const [sipManager] = useState(() => new SipManager({
    onStateChange: (state) => setSipState(state),
    onIncomingCall: (invitation, from) => {
      setCallState("ringing")
      setCurrentCall({
        callId: `sip-${Date.now()}`,
        fromUserName: from,
        fromNumber: from,
        isSipCall: true,
        sipInvitation: invitation,
      })
    },
    onSessionStateChange: (state) => {
      if (state === "Established") {
        setCallState("connected")
        startCallTimer()
        setCallStartTime(new Date())
      } else if (state === "Terminated" || state === "Ended") {
        handleCallEnd()
      } else if (state === "Establishing") {
        setCallState(cs => cs === "idle" ? "dialing" : cs)
      }
    },
  }))

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
    wsPort: "8089",
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
  const [testConnecting, setTestConnecting] = useState(false)

  // Call history (loaded from DB)
  const [callHistory, setCallHistory] = useState<CallRecord[]>([])

  // Refs
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

  // ─── Timer functions ───
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

  // ─── Persist call to DB ───
  const persistCallToDb = useCallback(async (call: any, duration: number, status: string) => {
    try {
      const direction = call.isSipCall
        ? (call.fromNumber ? "inbound" : "outbound")
        : (call.fromUserId ? "inbound" : "outbound")

      await fetch("/api/voip/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          fromNumber: call.fromNumber || (direction === "outbound" ? voipSettings.sipUsername : null),
          toNumber: call.toNumber || call.phoneNumber || null,
          fromName: call.fromUserName || null,
          toName: call.toUserName || null,
          duration,
          status,
          startedAt: callStartTime?.toISOString(),
          endedAt: new Date().toISOString(),
        }),
      })
    } catch (e) {
      console.error("Failed to persist call history:", e)
    }
  }, [callStartTime, voipSettings.sipUsername])

  // ─── Handle call end (shared by both SIP and WebRTC) ───
  const handleCallEnd = useCallback(() => {
    const call = currentCallRef.current
    const duration = callDuration

    // WebRTC: notify peer
    if (call && !call.isSipCall) {
      const sock = socketRef.current
      if (sock) {
        const targetId = call.toUserId || call.fromUserId
        sock.emit("hang-up", { targetUserId: targetId, callId: call.callId })
      }
    }

    // Save to local call history
    if (call) {
      const newRecord: CallRecord = {
        id: `rec-${Date.now()}`,
        name: call.toUserName || call.fromUserName || call.phoneNumber || call.fromNumber || "Unknown",
        phone: call.phoneNumber || call.toNumber || call.fromNumber || "",
        direction: call.fromUserId || call.fromNumber ? "incoming" : "outgoing",
        duration,
        timestamp: new Date(),
      }
      setCallHistory(prev => [newRecord, ...prev].slice(0, 50))

      // Persist to DB
      const status = duration > 0 ? "completed" : "cancelled"
      persistCallToDb(call, duration, status)
    }

    // Cleanup WebRTC
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
    localStreamRef.current = null
    remoteStreamRef.current = null

    setCallState("idle")
    setCurrentCall(null)
    setIsMuted(false)
    setIsDeafened(false)
    setIsOnHold(false)
    setCallDuration(0)
    setCallStartTime(null)
    stopCallTimer()
  }, [stopCallTimer, callDuration, persistCallToDb])

  const endCall = useCallback(async () => {
    const call = currentCallRef.current
    if (call?.isSipCall) {
      try {
        await sipManager.hangup()
      } catch { /* ignore */ }
    }
    handleCallEnd()
  }, [sipManager, handleCallEnd])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const formatTimestamp = (ts: Date | string) => {
    const d = typeof ts === "string" ? new Date(ts) : ts
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  // ─── Fetch online users ───
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/presence")
        if (res.ok) {
          const users = await res.json()
          setOnlineUsers(users.filter((u: any) => u.id !== (session?.user as any)?.id))
        }
      } catch { /* ignore */ }
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 10000)
    return () => clearInterval(interval)
  }, [session])

  // ─── Fetch contacts ───
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

  // ─── Fetch VoIP settings ───
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
              wsPort: data.wsPort || "8089",
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

  // ─── Fetch call history from DB ───
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/voip/history?limit=50")
        if (res.ok) {
          const data = await res.json()
          if (data.records) {
            setCallHistory(data.records.map((r: any) => ({
              id: r.id,
              name: r.fromName || r.toName || r.fromNumber || r.toNumber || "Unknown",
              phone: r.fromNumber || r.toNumber || "",
              direction: r.direction === "inbound" ? "incoming" : r.direction === "outbound" ? "outgoing" : "missed",
              duration: r.duration || 0,
              timestamp: r.startedAt,
            })))
          }
        }
      } catch { /* ignore */ }
    }
    fetchHistory()
  }, [])

  // ─── Auto-connect SIP when settings are loaded ───
  useEffect(() => {
    if (
      voipSettings.sipServer &&
      voipSettings.sipUsername &&
      voipSettings.sipPassword &&
      voipSettings.sipDomain &&
      sipState === "disconnected"
    ) {
      sipManager.connect(voipSettings).catch((e: any) => {
        console.error("Auto SIP connect failed:", e)
        setSipError(e.message || "Connection failed")
      })
    }
  }, [voipSettings.sipServer, voipSettings.sipUsername, voipSettings.sipDomain])

  // ─── Cleanup SIP on unmount ───
  useEffect(() => {
    return () => {
      sipManager.disconnect()
    }
  }, [])

  // ─── Connect to socket for WebRTC signaling ───
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
      // Only handle if not already in a SIP call
      if (callState !== "idle") return
      setCallState("ringing")
      setCurrentCall({ callId: data.callId, fromUserId: data.fromUserId, fromUserName: data.fromUserName, offer: data.offer, isSipCall: false })
    })

    newSocket.on("call-answered", async (data: any) => {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
          setCallState("connected")
          startCallTimer()
          setCallStartTime(new Date())
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
      handleCallEnd()
    })

    setSocket(newSocket)
    return () => {
      newSocket.close()
    }
  }, [session, startCallTimer])

  // ─── WebRTC peer connection ───
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
        handleCallEnd()
      }
    }

    peerConnectionRef.current = pc
    return pc
  }, [voipSettings])

  // ─── WebRTC: call an online CRM user ───
  const startCall = async (targetUserId: string, targetUserName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = createPeerConnection()
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const callId = `call-${Date.now()}`
      setCurrentCall({ callId, toUserId: targetUserId, toUserName: targetUserName, isSipCall: false })
      setCallState("calling")

      socketRef.current?.emit("call-user", { targetUserId, offer, callId })
    } catch (e) {
      console.error("Start call error:", e)
    }
  }

  // ─── Dial out: SIP if configured, otherwise show error ───
  const dialNumberCall = async () => {
    if (!dialNumber.trim()) return

    // If SIP is configured and registered, make a real SIP call
    if (voipSettings.sipServer && voipSettings.sipUsername && voipSettings.sipDomain) {
      if (sipState !== "registered") {
        setSipError("SIP not registered. Please wait or check connection.")
        return
      }

      setCallState("dialing")
      setCurrentCall({
        callId: `sip-${Date.now()}`,
        phoneNumber: dialNumber,
        toUserName: dialNumber,
        toNumber: dialNumber,
        isSipCall: true,
      })
      setCallStartTime(new Date())

      try {
        await sipManager.dial(dialNumber, voipSettings.sipDomain)
        // Session state change listener will update callState
      } catch (e: any) {
        console.error("SIP dial error:", e)
        setSipError(e.message || "Failed to place call")
        handleCallEnd()
      }
    } else {
      // No SIP configured - show error message
      setSipError("Configure SIP provider in settings to make external calls")
      setTimeout(() => setSipError(""), 3000)
    }
  }

  // ─── Answer call ───
  const answerCall = async () => {
    if (!currentCall) return

    if (currentCall.isSipCall && currentCall.sipInvitation) {
      try {
        await sipManager.answer(currentCall.sipInvitation)
        setCallState("connected")
        startCallTimer()
        setCallStartTime(new Date())
      } catch (e: any) {
        console.error("SIP answer error:", e)
        handleCallEnd()
      }
    } else {
      // WebRTC answer
      if (!currentCall.offer) return
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
        setCallStartTime(new Date())
      } catch (e) {
        console.error("Answer call error:", e)
      }
    }
  }

  // ─── Mute / Deafen / Hold ───
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

  const toggleHold = async () => {
    try {
      if (isOnHold) {
        await sipManager.unhold()
      } else {
        await sipManager.hold()
      }
      setIsOnHold(!isOnHold)
    } catch (e) {
      console.error("Hold/unhold error:", e)
    }
  }

  const handleTransfer = async () => {
    if (!transferNumber.trim()) return
    try {
      await sipManager.blindTransfer(transferNumber, voipSettings.sipDomain)
      setShowTransfer(false)
      setTransferNumber("")
      handleCallEnd()
    } catch (e: any) {
      console.error("Transfer error:", e)
      setSipError(e.message || "Transfer failed")
    }
  }

  // ─── Dialpad handlers ───
  const handleDialPress = async (digit: string) => {
    setDialNumber(prev => prev + digit)
    // Send DTMF if in a SIP call
    if (currentCall?.isSipCall && callState === "connected") {
      await sipManager.sendDtmf(digit)
    }
  }

  const handleDialDelete = () => {
    setDialNumber(prev => prev.slice(0, -1))
  }

  // ─── Save VoIP settings ───
  const saveVoIPSettings = async () => {
    setSettingsSaving(true)
    try {
      const res = await fetch("/api/voip/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voipSettings),
      })
      if (res.ok) {
        // Reconnect SIP with new settings
        if (voipSettings.sipServer && voipSettings.sipUsername && voipSettings.sipDomain) {
          try {
            await sipManager.disconnect()
            setSipError("")
            await sipManager.connect(voipSettings)
          } catch (e: any) {
            setSipError(e.message || "Connection failed")
          }
        }
      }
    } catch (e) {
      console.error("Failed to save VoIP settings:", e)
    } finally {
      setSettingsSaving(false)
    }
  }

  // ─── Test SIP Connection ───
  const testConnection = async () => {
    setTestConnecting(true)
    setSipError("")
    try {
      await sipManager.disconnect()
      await sipManager.connect(voipSettings)
      setSipError("")
    } catch (e: any) {
      setSipError(e.message || "Connection test failed")
    } finally {
      setTestConnecting(false)
    }
  }

  // ─── Filter contacts ───
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

  // ─── Dialpad keys ───
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

  // ─── SIP status helpers ───
  const sipStatusColor = () => {
    switch (sipState) {
      case "registered": return "bg-green-500"
      case "connecting":
      case "registering": return "bg-amber-500 animate-pulse"
      case "error": return "bg-red-500"
      default: return "bg-gray-400"
    }
  }

  const sipStatusText = () => {
    switch (sipState) {
      case "registered": return `Registered as sip:${voipSettings.sipUsername}@${voipSettings.sipDomain}`
      case "connecting": return "Connecting..."
      case "registering": return "Registering..."
      case "error": return sipError || "Connection error"
      default: return voipSettings.sipServer ? "Disconnected" : "Not configured"
    }
  }

  const isSipReady = sipState === "registered"

  // ─── VoIP Settings Panel ───
  if (showVoIPSettings) {
    return (
      <div className="w-72 sm:w-80 border-l border-border bg-card flex flex-col h-full">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
            <Settings size={16} /> VoIP Settings
          </h3>
          <button onClick={() => setShowVoIPSettings(false)} className="p-1 rounded hover:bg-accent transition-colors" aria-label="Close settings">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-4 space-y-5">
            {/* SIP Connection Status */}
            {voipSettings.sipServer && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${sipStatusColor()}`} />
                  <span className="text-xs font-medium text-foreground">SIP Status</span>
                </div>
                <p className="text-xs text-muted-foreground break-all">{sipStatusText()}</p>
                {voipSettings.sipUsername && voipSettings.sipDomain && (
                  <p className="text-xs text-muted-foreground font-mono">
                    URI: sip:{voipSettings.sipUsername}@{voipSettings.sipDomain}
                  </p>
                )}
                {voipSettings.sipServer && (
                  <p className="text-xs text-muted-foreground font-mono">
                    WSS: wss://{voipSettings.sipServer}:{voipSettings.wsPort || "8089"}
                  </p>
                )}
                {sipError && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} /> {sipError}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testConnecting || !voipSettings.sipServer || !voipSettings.sipUsername}
                  className="w-full h-7 text-xs"
                >
                  {testConnecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                  {testConnecting ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            )}

            {/* SIP Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">SIP Provider</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Server / Host</label>
                  <Input placeholder="sip.example.com" value={voipSettings.sipServer} onChange={(e) => setVoipSettings(s => ({ ...s, sipServer: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">SIP Port</label>
                    <Input placeholder="5060" value={voipSettings.sipPort} onChange={(e) => setVoipSettings(s => ({ ...s, sipPort: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">WSS Port</label>
                    <Input placeholder="8089" value={voipSettings.wsPort} onChange={(e) => setVoipSettings(s => ({ ...s, wsPort: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
                    <Input placeholder="example.com" value={voipSettings.sipDomain} onChange={(e) => setVoipSettings(s => ({ ...s, sipDomain: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Username / Auth ID</label>
                  <Input placeholder="1001" value={voipSettings.sipUsername} onChange={(e) => setVoipSettings(s => ({ ...s, sipUsername: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">SIP Password</label>
                  <Input type="password" placeholder="••••••••" value={voipSettings.sipPassword} onChange={(e) => setVoipSettings(s => ({ ...s, sipPassword: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Caller ID Name</label>
                  <Input placeholder="Your Name / Company" value={voipSettings.callerId} onChange={(e) => setVoipSettings(s => ({ ...s, callerId: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
            </div>

            {/* WebRTC / ICE Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">WebRTC / ICE Servers</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">STUN Server</label>
                  <Input placeholder="stun:stun.l.google.com:19302" value={voipSettings.stunServer} onChange={(e) => setVoipSettings(s => ({ ...s, stunServer: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">TURN Server (optional)</label>
                  <Input placeholder="turn:turn.example.com:3478" value={voipSettings.turnServer} onChange={(e) => setVoipSettings(s => ({ ...s, turnServer: e.target.value }))} className="h-8 text-sm" />
                </div>
                {voipSettings.turnServer && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">TURN Username</label>
                      <Input placeholder="username" value={voipSettings.turnUsername} onChange={(e) => setVoipSettings(s => ({ ...s, turnUsername: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">TURN Password</label>
                      <Input type="password" placeholder="••••••••" value={voipSettings.turnPassword} onChange={(e) => setVoipSettings(s => ({ ...s, turnPassword: e.target.value }))} className="h-8 text-sm" />
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
                  <button onClick={() => setVoipSettings(s => ({ ...s, autoAnswer: !s.autoAnswer }))} className={`relative w-10 h-5 rounded-full transition-colors ${voipSettings.autoAnswer ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${voipSettings.autoAnswer ? "translate-x-5" : ""}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">Do Not Disturb</span>
                  <button onClick={() => setVoipSettings(s => ({ ...s, doNotDisturb: !s.doNotDisturb }))} className={`relative w-10 h-5 rounded-full transition-colors ${voipSettings.doNotDisturb ? "bg-primary" : "bg-muted"}`}>
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
                  { name: "Twilio", server: "sip.twilio.com", wsPort: "443", port: "5060" },
                  { name: "Vonage", server: "sip.vonage.com", wsPort: "8089", port: "5060" },
                  { name: "RingCentral", server: "sip.ringcentral.com", wsPort: "8089", port: "5060" },
                  { name: "3CX", server: "", wsPort: "8089", port: "5060" },
                  { name: "Asterisk / FreePBX", server: "", wsPort: "8089", port: "5060" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setVoipSettings(s => ({
                      ...s,
                      sipServer: preset.server || s.sipServer,
                      sipPort: preset.port,
                      wsPort: preset.wsPort,
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
            <Button onClick={saveVoIPSettings} disabled={settingsSaving} className="w-full">
              {settingsSaving ? "Saving..." : "Save Settings"}
            </Button>
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
          {sipState === "registered" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              SIP
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowVoIPSettings(true)} className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="VoIP Settings">
            <Settings size={14} className="text-muted-foreground" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent transition-colors" aria-label="Close VoIP panel">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <audio ref={audioRef} autoPlay />

      {/* SIP Error Toast */}
      {sipError && !showVoIPSettings && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
          <AlertCircle size={12} className="text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400 flex-1">{sipError}</span>
          <button onClick={() => setSipError("")} className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40">
            <X size={10} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Transfer Dialog */}
      {showTransfer && callState === "connected" && (
        <div className="mx-3 mt-2 p-3 rounded-lg bg-muted/50 border border-border space-y-2">
          <p className="text-xs font-medium text-foreground">Blind Transfer</p>
          <Input
            placeholder="Transfer to number..."
            value={transferNumber}
            onChange={(e) => setTransferNumber(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleTransfer() }}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowTransfer(false); setTransferNumber("") }} className="flex-1 h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleTransfer} disabled={!transferNumber.trim()} className="flex-1 h-7 text-xs">
              Transfer
            </Button>
          </div>
        </div>
      )}

      {/* Active Call */}
      {callState !== "idle" && (
        <div className="p-3 sm:p-4 border-b border-border bg-primary/5">
          <div className="text-center mb-3">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-2 ${
              isOnHold ? "bg-amber-100 dark:bg-amber-900/30" :
              callState === "dialing" || callState === "calling" ? "bg-primary/10" :
              callState === "ringing" ? "bg-green-100 dark:bg-green-900/30" :
              "bg-primary/10"
            }`}>
              {callState === "dialing" || callState === "calling" ? (
                <Phone size={22} className="text-primary animate-pulse" />
              ) : callState === "ringing" ? (
                <Phone size={22} className="text-green-600 dark:text-green-400 animate-pulse" />
              ) : isOnHold ? (
                <Pause size={22} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <Phone size={22} className="text-primary" />
              )}
            </div>
            <p className="font-medium text-foreground text-sm sm:text-base">
              {callState === "dialing" && `Dialing ${currentCall?.phoneNumber || currentCall?.toUserName}...`}
              {callState === "calling" && `Calling ${currentCall?.toUserName}...`}
              {callState === "ringing" && `Incoming from ${currentCall?.fromUserName || currentCall?.fromNumber}`}
              {callState === "connected" && (isOnHold ? "On Hold" : `In call with ${currentCall?.toUserName || currentCall?.fromUserName || currentCall?.phoneNumber}`)}
              {callState === "held" && `On Hold - ${currentCall?.toUserName || currentCall?.phoneNumber}`}
            </p>
            {(callState === "connected" || callState === "held") && (
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {formatDuration(callDuration)}
                {currentCall?.isSipCall && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">SIP</span>
                )}
              </p>
            )}
            {(callState === "dialing" || callState === "calling") && (
              <p className="text-sm text-muted-foreground mt-1">Connecting...</p>
            )}
            {callState === "ringing" && (
              <p className="text-sm text-primary animate-pulse mt-1">Ringing...</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {callState === "ringing" && (
              <>
                <Button onClick={answerCall} size="sm" className="bg-green-500 hover:bg-green-600">
                  <Phone size={14} /> Answer
                </Button>
                <Button onClick={endCall} size="sm" variant="destructive">
                  <PhoneOff size={14} /> Reject
                </Button>
              </>
            )}
            {(callState === "connected" || callState === "held") && (
              <>
                <Button onClick={toggleMute} size="sm" variant={isMuted ? "destructive" : "outline"} title={isMuted ? "Unmute" : "Mute"}>
                  {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </Button>
                <Button onClick={toggleDeafen} size="sm" variant={isDeafened ? "destructive" : "outline"} title={isDeafened ? "Unmute speaker" : "Mute speaker"}>
                  {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </Button>
                {currentCall?.isSipCall && (
                  <>
                    <Button onClick={toggleHold} size="sm" variant={isOnHold ? "secondary" : "outline"} title={isOnHold ? "Unhold" : "Hold"}>
                      {isOnHold ? <Play size={14} /> : <Pause size={14} />}
                    </Button>
                    <Button onClick={() => setShowTransfer(true)} size="sm" variant="outline" title="Transfer" disabled={showTransfer}>
                      <PhoneForwarded size={14} />
                    </Button>
                  </>
                )}
                <Button onClick={endCall} size="sm" variant="destructive">
                  <PhoneOff size={14} /> End
                </Button>
              </>
            )}
            {(callState === "dialing" || callState === "calling") && (
              <Button onClick={endCall} size="sm" variant="destructive">
                <PhoneOff size={14} /> Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
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
                <button onClick={handleDialDelete} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors" aria-label="Delete last digit">
                  <Delete size={16} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="grid grid-cols-3 gap-2">
              {dialpadKeys.map(({ digit, sub }) => (
                <button
                  key={digit}
                  onClick={() => handleDialPress(digit)}
                  className={`flex flex-col items-center justify-center h-14 rounded-xl transition-colors select-none active:scale-95 ${
                    callState === "connected" && currentCall?.isSipCall
                      ? "bg-primary/10 hover:bg-primary/20 active:bg-primary/30"
                      : "bg-muted/50 hover:bg-muted active:bg-muted/80"
                  }`}
                >
                  <span className="text-xl font-semibold text-foreground leading-none">{digit}</span>
                  {sub && <span className="text-[9px] text-muted-foreground tracking-wider mt-0.5">{sub}</span>}
                </button>
              ))}
            </div>
            {callState === "connected" && currentCall?.isSipCall && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">Press keys to send DTMF tones</p>
            )}
          </div>

          <div className="px-4 pb-4 mt-1">
            <button
              onClick={dialNumberCall}
              disabled={!dialNumber.trim() || callState !== "idle"}
              className="w-full h-14 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Phone size={20} />
              {isSipReady ? "SIP Call" : "Call"}
            </button>
          </div>

          {/* Recent Calls */}
          {callHistory.length > 0 && (
            <div className="border-t border-border flex-1 min-h-0">
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</h4>
                <Clock size={12} className="text-muted-foreground" />
              </div>
              <ScrollArea className="max-h-40">
                <div className="px-4 pb-3 space-y-1">
                  {callHistory.map((rec) => (
                    <div key={rec.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
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
                          {rec.timestamp && ` · ${formatTimestamp(rec.timestamp)}`}
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
              <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                sipState === "registered"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : sipState === "error"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
              }`}>
                <div className={`w-2 h-2 rounded-full ${sipStatusColor()}`} />
                <span className={`text-xs ${
                  sipState === "registered" ? "text-green-700 dark:text-green-400" :
                  sipState === "error" ? "text-red-700 dark:text-red-400" :
                  "text-amber-700 dark:text-amber-400"
                }`}>
                  {sipState === "registered" ? `SIP: ${voipSettings.sipServer} (${voipSettings.sipUsername})` :
                   sipState === "connecting" || sipState === "registering" ? `SIP: ${voipSettings.sipServer} — Connecting...` :
                   sipState === "error" ? `SIP: Connection failed` :
                   `SIP: ${voipSettings.sipServer} — Disconnected`}
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowVoIPSettings(true)}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <WifiOff size={12} className="text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Configure VoIP provider to make external calls
                </span>
              </button>
            )}
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="flex-1 min-h-0 mt-0 flex flex-col">
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>

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
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customers</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{filteredCustomers.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {filteredCustomers.map((customer) => (
                          <div key={customer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                <User size={14} className="text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{customer.phone}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setDialNumber(customer.phone || ""); setActiveTab("dialpad") }}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                              aria-label={`Dial ${customer.name}`}
                            >
                              <Phone size={12} />
                            </button>
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
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Companies</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{filteredCompanies.length}</Badge>
                      </div>
                      <div className="space-y-1">
                        {filteredCompanies.map((company) => (
                          <div key={company.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <Building2 size={14} className="text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{company.phone}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setDialNumber(company.phone || ""); setActiveTab("dialpad") }}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                              aria-label={`Dial ${company.name}`}
                            >
                              <Phone size={12} />
                            </button>
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
                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center shrink-0">
                      <span className="text-background text-xs font-bold">
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name || user.email}</p>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                        <span className="text-xs text-muted-foreground">Online</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startCall(user.id, user.name || user.email)} disabled={callState !== "idle"} className="shrink-0" aria-label={`Call ${user.name || user.email}`}>
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
