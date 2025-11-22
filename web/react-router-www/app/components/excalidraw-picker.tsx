import * as React from "react"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

interface ExcalidrawBoard {
  id: number
  name: string
  user_id?: number
  user?: { id: number; nickname?: string; username?: string }
  created_at?: number
  updated_at?: number
}

interface ExcalidrawPickerProps {
  value?: string | number | null
  onChange: (id: string | undefined) => void
  isAdmin?: boolean
  previewCompact?: boolean
}

export function ExcalidrawPicker({ value, onChange, isAdmin = true, previewCompact = false }: ExcalidrawPickerProps) {
  const [loading, setLoading] = React.useState(false)
  const [boards, setBoards] = React.useState<ExcalidrawBoard[]>([])
  const [keyword, setKeyword] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [tempSelectedId, setTempSelectedId] = React.useState<string | undefined>(undefined)

  const selectedId = value && value !== "none" ? String(value) : undefined

  const loadBoards = React.useCallback(async () => {
    setLoading(true)
    try {
      const url = isAdmin
        ? `${HOST_URL}/api/excalidraw/boards/all?pageSize=100`
        : `${HOST_URL}/api/excalidraw/boards?pageSize=100`
      const res = await fetchWithAuth(url)
      const data = await res.json()
      const list: ExcalidrawBoard[] = Array.isArray(data?.data) ? data.data : []
      setBoards(list)
    } catch (e) {
      setBoards([])
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  React.useEffect(() => {
    loadBoards()
  }, [loadBoards])

  React.useEffect(() => {
    // 打开弹窗时，将临时选择同步为当前值
    if (dialogOpen) {
      setTempSelectedId(selectedId)
    }
  }, [dialogOpen, selectedId])

  const filtered = React.useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return boards
    return boards.filter(b =>
      String(b.id).toLowerCase().includes(k) ||
      (b.name || "").toLowerCase().includes(k) ||
      (b.user?.nickname || b.user?.username || "").toLowerCase().includes(k)
    )
  }, [boards, keyword])

  return (
    <div className="space-y-3">
      {/* 顶部操作：仅显示按钮，不常驻列表 */}
      <div className="flex items-center gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">{selectedId ? "更换流程图" : "选择流程图"}</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>选择流程图</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col flex-1 min-h-0 space-y-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Input
                  placeholder="搜索画板（按名称/ID/作者）"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={loadBoards} disabled={loading}>
                  刷新
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pr-1">
                  {filtered.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setTempSelectedId(String(b.id))}
                      className={`text-left rounded-lg border transition hover:shadow-sm ${tempSelectedId === String(b.id) ? "ring-2 ring-blue-400" : ""}`}
                    >
                      <div className="w-full h-36 overflow-hidden rounded-t-lg bg-white">
                        <img
                          src={`${HOST_URL}/api/excalidraw/boards/${b.id}/thumbnail`}
                          alt={b.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2 space-y-1">
                        <div className="text-sm font-medium truncate" title={b.name}>{b.name || `画板 ${b.id}`}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>ID:{b.id}</span>
                          {b.user?.nickname || b.user?.username ? (
                            <span>· {b.user?.nickname || b.user?.username}</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button
                  type="button"
                  onClick={() => {
                    onChange(tempSelectedId)
                    setDialogOpen(false)
                  }}
                  disabled={!tempSelectedId}
                >
                  确认选择
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {selectedId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => window.open(`/www/excalidraw/open/${selectedId}`, "_blank")}
          >
            打开流程图
          </Button>
        )}

        {selectedId && (
          <Button type="button" variant="destructive" onClick={() => onChange(undefined)}>清除</Button>
        )}
      </div>

      {/* 已选缩略图（只显示缩略图，不展示画板本体） */}
      {selectedId ? (
        <div className="rounded border p-3 bg-muted/50 max-w-md">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">ID: {selectedId}</Badge>
          </div>
          <div className={`w-full overflow-hidden rounded-md border bg-white ${previewCompact ? "h-40" : "h-48"}`}>
            <img
              src={`${HOST_URL}/api/excalidraw/boards/${selectedId}/thumbnail`}
              alt="Excalidraw 缩略图"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">未选择流程图</p>
      )}
    </div>
  )
}

export default ExcalidrawPicker


