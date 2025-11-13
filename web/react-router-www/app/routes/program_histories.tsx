import * as React from "react"
import { useParams } from "react-router"
import { ArrowLeft, History, Calendar, Clock, Code2 } from "lucide-react"
import { Toaster, toast } from "sonner"

import { LayoutProvider } from "~/components/layout-provider"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { fetchWithAuth } from "~/utils/api"

interface ProgramHistory {
  filename: string
  created_at: string
}

interface ProgramHistoriesResponse {
  program_id: number
  name: string
  ext: number
  created_at: string
  updated_at: string
  histories: ProgramHistory[]
}

function formatDate(dateString?: string) {
  if (!dateString) return "未知时间"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "未知时间"
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return "时间格式错误"
  }
}

function extractMd5(filename: string) {
  const parts = filename.split("_")
  return parts.length >= 2 ? parts.slice(1).join("_") : filename
}

export default function ProgramHistories() {
  const { programId } = useParams()
  const [historiesData, setHistoriesData] = React.useState<ProgramHistoriesResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewContent, setPreviewContent] = React.useState("")
  const [previewMd5, setPreviewMd5] = React.useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)
  const [restoreLoadingMd5, setRestoreLoadingMd5] = React.useState<string | null>(null)
  const [downloadLoadingMd5, setDownloadLoadingMd5] = React.useState<string | null>(null)

  const loadHistories = React.useCallback(async () => {
    if (!programId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/programs/${programId}/histories`)
      if (!res.ok) {
        throw new Error(`加载失败: ${res.status}`)
      }
      const respJson = await res.json()
      const data: ProgramHistoriesResponse = respJson?.data || respJson
      setHistoriesData(data)
    } catch (e: any) {
      setError(e?.message || "加载历史记录失败")
    } finally {
      setIsLoading(false)
    }
  }, [programId])

  React.useEffect(() => {
    loadHistories()
  }, [loadHistories])

  const programType = React.useMemo(() => {
    switch (historiesData?.ext) {
      case 1:
        return "python"
      case 2:
        return "javascript"
      case 3:
        return "typescript"
      case 4:
        return "go"
      case 5:
        return "java"
      default:
        return "python"
    }
  }, [historiesData?.ext])

  const fetchHistoryContent = React.useCallback(
    async (md5: string) => {
      if (!programId) return ""
      const res = await fetchWithAuth(`/api/programs/${programId}?md5=${md5}`)
      if (!res.ok) {
        throw new Error(`获取历史内容失败: ${res.status}`)
      }
      const respJson = await res.json()
      const data = respJson?.data || respJson
      return data?.program || ""
    },
    [programId],
  )

  const handlePreview = React.useCallback(
    async (md5: string) => {
      setPreviewMd5(md5)
      setPreviewLoading(true)
      try {
        const content = await fetchHistoryContent(md5)
        setPreviewContent(content)
        setPreviewOpen(true)
      } catch (e: any) {
        toast.error(e?.message || "获取历史内容失败")
      } finally {
        setPreviewLoading(false)
      }
    },
    [fetchHistoryContent],
  )

  const handleRestore = React.useCallback(
    async (md5: string) => {
      if (!historiesData || !programId) return
      setRestoreLoadingMd5(md5)
      try {
        const content = await fetchHistoryContent(md5)
        const resp = await fetchWithAuth("/api/programs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: historiesData.program_id,
            name: historiesData.name,
            type: programType,
            program: content,
          }),
        })
        if (!resp.ok) {
          throw new Error(`恢复失败: ${resp.status}`)
        }
        toast.success("历史版本已恢复为当前版本")
        await loadHistories()
      } catch (e: any) {
        toast.error(e?.message || "恢复历史版本失败")
      } finally {
        setRestoreLoadingMd5(null)
      }
    },
    [fetchHistoryContent, historiesData, loadHistories, programType, programId],
  )

  const handleDownload = React.useCallback(
    async (md5: string) => {
      if (!historiesData) return
      setDownloadLoadingMd5(md5)
      try {
        const content = await fetchHistoryContent(md5)
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
        const filename = `${historiesData.name || "program"}_${md5}.py`
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        toast.success("历史文件已下载")
      } catch (e: any) {
        toast.error(e?.message || "下载历史文件失败")
      } finally {
        setDownloadLoadingMd5(null)
      }
    },
    [fetchHistoryContent, historiesData],
  )

  const programName = historiesData?.name || "程序"

  return (
    <LayoutProvider
      title={programId ? `${programName} - 历史文件` : "程序历史文件"}
      subtitle="查看此程序的历史版本记录"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <History className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">
                  {programName} - 历史文件
                </CardTitle>
                <CardDescription>查看程序的历史版本以及保存时间</CardDescription>
              </div>
            </div>

            <Button
              size="lg"
              onClick={() => window.history.back()}
              className="fun-button-secondary gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </Button>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-lg border-2 border-purple-200 bg-white shadow-sm flex items-center justify-center">
                  <Code2 className="h-8 w-8 text-purple-500" />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">程序 ID:</span>
                  <span className="font-mono text-gray-800">{historiesData?.program_id || programId}</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {historiesData?.created_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-500" />
                      <span className="font-medium">创建时间:</span>
                      <span>{formatDate(historiesData.created_at)}</span>
                    </div>
                  )}
                  {historiesData?.updated_at && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">更新时间:</span>
                      <span>{formatDate(historiesData.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl overflow-hidden border">
            {isLoading ? (
              <div className="text-center py-10 text-gray-500">历史文件加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>历史文件名</TableHead>
                    <TableHead>MD5</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historiesData?.histories?.length ? (
                    historiesData.histories.map((history) => {
                      const md5 = extractMd5(history.filename)
                      return (
                        <TableRow key={history.filename}>
                          <TableCell className="font-mono">{history.filename}</TableCell>
                          <TableCell className="font-mono">{md5}</TableCell>
                          <TableCell>{formatDate(history.created_at)}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreview(md5)}
                              disabled={previewLoading && previewMd5 === md5}
                            >
                              查看
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(md5)}
                              disabled={restoreLoadingMd5 === md5}
                            >
                              {restoreLoadingMd5 === md5 ? "恢复中..." : "恢复"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(md5)}
                              disabled={downloadLoadingMd5 === md5}
                            >
                              {downloadLoadingMd5 === md5 ? "下载中..." : "下载"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                        暂无历史文件
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>历史版本预览</DialogTitle>
            <DialogDescription>
              {previewMd5 ? `MD5: ${previewMd5}` : "加载历史版本内容"}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border bg-muted p-4">
            {previewLoading ? (
              <div className="text-center text-gray-500">内容加载中...</div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{previewContent}</pre>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" theme="light" richColors />
    </LayoutProvider>
  )
}

