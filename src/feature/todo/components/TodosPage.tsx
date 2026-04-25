"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Icon } from "@iconify/react"

const STATUSES = ["Todo", "InProgress", "OnHold", "Done"]
const PRIORITIES = ["Low", "Medium", "High", "Urgent"]
const statusColors: Record<string, string> = { Todo: "bg-gray-500", InProgress: "bg-blue-500", OnHold: "bg-amber-500", Done: "bg-green-500" }
const statusLabels: Record<string, string> = { Todo: "To Do", InProgress: "In Progress", OnHold: "On Hold", Done: "Done" }
const priorityColors: Record<string, string> = { Low: "secondary", Medium: "outline", High: "default", Urgent: "destructive" }

export default function TodosPage() {
  const spaceId = useCurrentSpace()
  const isMobile = useIsMobile()
  const [todos, setTodos] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [editTodo, setEditTodo] = useState<any>(null)
  const [form, setForm] = useState({ title: "", description: "", status: "Todo", priority: "Medium", dueDate: "" })

  const fetchData = () => { if (!spaceId) return; fetch(`/api/todos?spaceId=${spaceId}`).then(r => r.json()).then(setTodos).catch(() => {}) }
  useEffect(() => { fetchData() }, [spaceId])

  const handleCreate = async () => {
    await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, spaceId }) })
    setShowCreate(false); setForm({ title: "", description: "", status: "Todo", priority: "Medium", dueDate: "" }); fetchData()
  }
  const handleUpdate = async (id: string, data: any) => { await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); setEditTodo(null); fetchData() }
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await fetch(`/api/todos/${id}`, { method: "DELETE" }); fetchData() }

  const filtered = todos.filter(t => (statusFilter === "all" || t.status === statusFilter) && (!search || t.title.toLowerCase().includes(search.toLowerCase())))

  const isDealLinked = (todo: any) => todo.linkedTo && todo.linkedTo.startsWith("deal:")
  const getDealId = (todo: any) => {
    if (!isDealLinked(todo)) return null
    return todo.linkedTo.replace("deal:", "")
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none"><Icon icon="mdi:magnify" width={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search todos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-64 min-h-[44px]" /></div>
          {/* Desktop-only filter select */}
          {!isMobile && (
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36 min-h-[36px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
          )}
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button className="min-h-[44px] w-full sm:w-auto"><Icon icon="mdi:plus" width={16} className="mr-1" /> Add Task</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Task Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="min-h-[44px]" />
            <Input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-[44px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            </div>
            <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="min-h-[44px]" />
            <Button onClick={handleCreate} className="w-full min-h-[44px]" disabled={!form.title}>Create Task</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      {/* Mobile: Swipeable status filter tabs */}
      {isMobile && (
        <div className="-mx-4 px-4">
          <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-[44px] transition-colors ${
                statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium min-h-[44px] transition-colors flex items-center gap-1.5 ${
                  statusFilter === status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Board View */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 min-w-[300px] sm:min-w-0">
          {STATUSES.map(status => {
            const statusTodos = filtered.filter(t => t.status === status)
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                  <span className="font-medium text-sm">{statusLabels[status]}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">{statusTodos.length}</Badge>
                </div>
                <div className="space-y-2">
                  {statusTodos.map(todo => (
                    <Card key={todo.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => setEditTodo(todo)}>
                      <CardContent className="p-3 sm:p-3">
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-sm font-medium">{todo.title}</p>
                          {isDealLinked(todo) && (
                            <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1.5 py-0 gap-0.5 border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400">
                              <Icon icon="mdi:handshake-outline" width={10} />
                              Deal
                            </Badge>
                          )}
                        </div>
                        {todo.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant={priorityColors[todo.priority] as any} className="text-xs">{todo.priority}</Badge>
                          {todo.dueDate && <span className="text-xs text-muted-foreground">{new Date(todo.dueDate).toLocaleDateString()}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          {todo.assignedTo?.name ? (
                            <span className="text-xs text-muted-foreground">{todo.assignedTo.name}</span>
                          ) : todo.owner?.name ? (
                            <span className="text-xs text-muted-foreground">{todo.owner.name}</span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={!!editTodo} onOpenChange={() => setEditTodo(null)}><DialogContent><DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
        {editTodo && <div className="space-y-3">
          {isDealLinked(editTodo) && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <Icon icon="mdi:handshake-outline" width={16} className="text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <span className="text-xs text-orange-700 dark:text-orange-300">From Deal — synced from deal task</span>
            </div>
          )}
          <Input value={editTodo.title} onChange={e => setEditTodo({ ...editTodo, title: e.target.value })} className="min-h-[44px]" />
          <Input value={editTodo.description || ""} onChange={e => setEditTodo({ ...editTodo, description: e.target.value })} placeholder="Description" className="min-h-[44px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={editTodo.status} onValueChange={v => setEditTodo({ ...editTodo, status: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select>
            <Select value={editTodo.priority} onValueChange={v => setEditTodo({ ...editTodo, priority: v })}><SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editTodo.id, editTodo)} className="flex-1 min-h-[44px]">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editTodo.id); setEditTodo(null) }} className="min-h-[44px] min-w-[44px]"><Icon icon="mdi:delete-outline" width={16} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
