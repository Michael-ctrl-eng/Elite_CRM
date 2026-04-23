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
} from "lucide-react"
import { io, Socket } from "socket.io-client"
import { useCurrentSpace } from "@/app/page"

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

export default function VoIPPanel({ onClose }: VoIPPanelProps) {
  const { data: session } = useSession()
  const spaceId = useCurrentSpace()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "connected">("idle")
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  // Contacts state
  const [contacts, setContacts] = useState<{
    customers: ContactItem[]
    companies: ContactItem[]
  }>({ customers: [], companies: [] })
  const [contactsLoading, setContactsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("online")

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
      } catch (e) {
        /* ignore */
      }
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
        } catch (e) {
          console.error("Set remote answer error:", e)
        }
      }
    })

    // ICE candidate
    newSocket.on("ice-candidate", async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
        } catch (e) {
          console.error("Add ICE candidate error:", e)
        }
      }
    })

    // Call ended
    newSocket.on("call-ended", () => {
      endCall()
    })

    setSocket(newSocket)
    return () => {
      newSocket.close()
    }
  }, [session, startCallTimer, endCall])

  const createPeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
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
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

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
      alert("Could not access microphone.")
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

  return (
    <div className="w-72 sm:w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Phone size={16} /> VoIP
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent transition-colors"
          aria-label="Close VoIP panel"
        >
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <audio ref={audioRef} autoPlay />

      {/* Active Call */}
      {callState !== "idle" && (
        <div className="p-3 sm:p-4 border-b border-border bg-primary/5">
          <div className="text-center mb-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Phone size={20} className="text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm sm:text-base">
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="online" className="flex-1 text-xs sm:text-sm">
              <User size={14} />
              Online ({onlineUsers.length})
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1 text-xs sm:text-sm">
              <PhoneCall size={14} />
              Contacts
            </TabsTrigger>
          </TabsList>
        </div>

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
                            <a
                              href={`tel:${customer.phone}`}
                              className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                              aria-label={`Call ${customer.name} at ${customer.phone}`}
                            >
                              <Phone size={12} />
                            </a>
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
                            <a
                              href={`tel:${company.phone}`}
                              className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                              aria-label={`Call ${company.name} at ${company.phone}`}
                            >
                              <Phone size={12} />
                            </a>
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
      </Tabs>
    </div>
  )
}
