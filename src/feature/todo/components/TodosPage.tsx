"use client"
import { useState, useEffect } from "react"
import { useCurrentSpace } from "@/app/page"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, Edit2 } from "lucide-react"

const STATUSES = ["Todo", "InProgress", "OnHold", "Done"]
const PRIORITIES = ["Low", "Medium", "High", "Urgent"]
const statusColors: Record<string, string> = { Todo: "bg-gray-500", InProgress: "bg-blue-500", OnHold: "bg-amber-500", Done: "bg-green-500" }
const priorityColors: Record<string, string> = { Low: "secondary", Medium: "outline", High: "default", Urgent: "destructive" }

export default function TodosPage() {
  const spaceId = useCurrentSpace()
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search todos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64" /></div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button><Plus size={14} /> Add Task</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader><div className="space-y-3">
            <Input placeholder="Task Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            </div>
            <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            <Button onClick={handleCreate} className="w-full" disabled={!form.title}>Create Task</Button>
          </div></DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUSES.map(status => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3"><div className={`w-2 h-2 rounded-full ${statusColors[status]}`} /><span className="font-medium text-sm">{status}</span><Badge variant="secondary" className="ml-auto text-xs">{filtered.filter(t => t.status === status).length}</Badge></div>
            <div className="space-y-2">
              {filtered.filter(t => t.status === status).map(todo => (
                <Card key={todo.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEditTodo(todo)}>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">{todo.title}</p>
                    {todo.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant={priorityColors[todo.priority] as any} className="text-xs">{todo.priority}</Badge>
                      {todo.dueDate && <span className="text-xs text-muted-foreground">{new Date(todo.dueDate).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{todo.assignedTo?.name || todo.owner?.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editTodo} onOpenChange={() => setEditTodo(null)}><DialogContent><DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
        {editTodo && <div className="space-y-3">
          <Input value={editTodo.title} onChange={e => setEditTodo({ ...editTodo, title: e.target.value })} />
          <Input value={editTodo.description || ""} onChange={e => setEditTodo({ ...editTodo, description: e.target.value })} placeholder="Description" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={editTodo.status} onValueChange={v => setEditTodo({ ...editTodo, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={editTodo.priority} onValueChange={v => setEditTodo({ ...editTodo, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex gap-2"><Button onClick={() => handleUpdate(editTodo.id, editTodo)} className="flex-1">Save</Button><Button variant="destructive" onClick={() => { handleDelete(editTodo.id); setEditTodo(null) }}><Trash2 size={14} /></Button></div>
        </div>}
      </DialogContent></Dialog>
    </div>
  )
}
