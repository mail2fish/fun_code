import * as React from "react"
import { IconPlus, IconTrash, IconCloudUpload, IconRefresh, IconFiles, IconPhoto } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"

import {
  uploadResourceFiles,
} from "~/utils/file-library"
import type { ResourceFile, UploadResourceFilesResult } from "~/utils/file-library"
import { HOST_URL } from "~/config"
import { fetchWithAuth } from "~/utils/api"

interface ResourceFileManagerProps {
  value: ResourceFile[]
  onChange: (files: ResourceFile[]) => void
  allowUpload?: boolean
  title?: string
}

const DEFAULT_PAGE_SIZE = 30
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp)$/i
const PREVIEWABLE_TYPES = new Set([1, 2]) // 1: image, 2: scratch sprite (可预览)

function canPreview(file: ResourceFile) {
  if (PREVIEWABLE_TYPES.has(file.content_type)) return true
  return IMAGE_EXTENSIONS.test(file.name) || IMAGE_EXTENSIONS.test(file.original_name ?? "")
}

function renderPreviewThumb(file: ResourceFile, size = 56) {
  if (!canPreview(file)) {
    return (
    <div
      className="flex items-center justify-center rounded-md bg-slate-100 text-slate-400"
      style={{ width: size, height: size }}
    >
      <IconPhoto className="h-5 w-5" />
    </div>
    )
  }
  const src = `${HOST_URL}/api/files/${file.id}/preview`
  return (
    <img
      src={src}
      alt={file.description || file.name}
      style={{ width: size, height: size }}
      className="rounded-md border border-slate-200 object-cover bg-white"
    />
  )
}

export function ResourceFileManager({
  value,
  onChange,
  allowUpload = true,
  title = "课程资源文件",
}: ResourceFileManagerProps) {
  const [bindDialogOpen, setBindDialogOpen] = React.useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
  const [files, setFiles] = React.useState<ResourceFile[]>([])
  const [search, setSearch] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const [sortOrder] = React.useState<"asc" | "desc">("desc")
  const searchTimer = React.useRef<number | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const requestInProgress = React.useRef(false)

  const [pendingFiles, setPendingFiles] = React.useState<
    Array<{ id: string; file: File; name: string; description: string }>
  >([])
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 数据请求函数 - 完全按照 file-table.tsx 的逻辑
  async function fetchData({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) {
    if (requestInProgress.current) return
    requestInProgress.current = true
    const pageSize = 20
    let beginID = "0"
    let forward = true
    let asc = sortOrder === "asc"

    if (reset && customBeginID) {
      beginID = customBeginID
    } else if (!reset && files.length > 0) {
      if (direction === "up") {
        beginID = files[0].id.toString()
        forward = false
      } else {
        beginID = files[files.length - 1].id.toString()
        forward = true
      }
    }

    if (direction === "up") setLoadingTop(true)
    if (direction === "down") setLoadingBottom(true)
    try {
      const params = new URLSearchParams()
      params.append("page_size", String(pageSize))
      params.append("forward", String(forward))
      params.append("asc", String(asc))
      if (beginID !== "0") params.append("begin_id", beginID)
      const res = await fetchWithAuth(`${HOST_URL}/api/files/list?${params.toString()}`)
      const resp = await res.json()
      let newFiles: ResourceFile[] = []
      if (Array.isArray(resp.data?.files)) {
        newFiles = resp.data.files
      }
      if (reset) {
        setFiles(newFiles)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        return
      }
      if (direction === "up") {
        if (newFiles.length === 0) setHasMoreTop(false)
        setFiles(prev => {
          const merged = [...newFiles, ...prev]
          let mergedFiles = merged.slice(0, 30)
          return mergedFiles
        })
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreTop(!!resp.meta.has_next)
        }
        if (newFiles.length > 0) setHasMoreBottom(true)
      } else {
        if (newFiles.length === 0) setHasMoreBottom(false)
        setFiles(prev => {
          const merged = [...prev, ...newFiles]
          let mergedFiles = merged.slice(-30)
          return mergedFiles
        })
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreBottom(!!resp.meta.has_next)
        }
        if (newFiles.length > 0) setHasMoreTop(true)
      }
    } catch (error: any) {
      console.error("加载资源文件失败:", error)
      toast.error(error?.message || "加载资源文件失败")
    } finally {
      requestInProgress.current = false
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      setLocalInitialLoading(false)
    }
  }

  // 搜索逻辑 - 带防抖
  React.useEffect(() => {
    if (!bindDialogOpen) return
    
    if (!search || search.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setFiles([])
      setHasMoreTop(true)
      setHasMoreBottom(true)
      setLocalInitialLoading(true)
      fetchData({ direction: "down", reset: true, customBeginID: "0" })
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/files/search?keyword=${encodeURIComponent(search)}`)
        const data = await res.json()
        if (Array.isArray(data.data?.files)) {
          setFiles(data.data.files)
        } else {
          setFiles([])
        }
        setHasMoreTop(false)
        setHasMoreBottom(false)
        setLocalInitialLoading(false)
      } catch (error) {
        console.error("搜索文件失败:", error)
        setFiles([])
        toast.error("搜索文件失败")
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, bindDialogOpen])

  // 打开对话框时加载初始数据
  React.useEffect(() => {
    if (bindDialogOpen && !search) {
      setFiles([])
      setHasMoreTop(true)
      setHasMoreBottom(true)
      setLocalInitialLoading(true)
      fetchData({ direction: "down", reset: true, customBeginID: "0" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindDialogOpen])

  // 滚动监听 - 完全按照 file-table.tsx 的逻辑
  const TOP_THRESHOLD = 12
  const BOTTOM_THRESHOLD = 10

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (search) return
    const el = e.currentTarget
    if (el.scrollTop <= TOP_THRESHOLD && hasMoreTop && !loadingTop && !requestInProgress.current) {
      fetchData({ direction: "up" })
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
      fetchData({ direction: "down" })
    }
  }

  const handleAddFile = React.useCallback(
    (file: ResourceFile) => {
      if (value.some((item) => item.id === file.id)) {
        toast.info("该资源文件已添加")
        return
      }
      onChange([...value, file])
      toast.success("资源文件已添加")
    },
    [onChange, value]
  )

  const handleRemoveFile = React.useCallback(
    (fileId: number) => {
      onChange(value.filter((file) => file.id !== fileId))
    },
    [onChange, value]
  )

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
  }

  const resetUploadState = () => {
    setPendingFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = async () => {
    if (!pendingFiles.length) {
      toast.error("请先选择要上传的文件")
      return
    }

    setUploading(true)
    try {
      const payload = pendingFiles.map((item) => ({
        file: item.file,
        name: item.name.trim() || item.file.name,
        description: item.description.trim() || item.file.name.replace(/\.[^/.]+$/, ""),
      }))
      const result: UploadResourceFilesResult = await uploadResourceFiles(payload)

      if (result.failedCount > 0 && result.failedFiles.length) {
        toast.error(result.failedFiles[0].error || "部分文件上传失败")
      }

      if (result.successCount > 0 && result.successFiles.length) {
        toast.success(`成功上传 ${result.successFiles.length} 个文件`)
        const uniqueNewFiles = result.successFiles.filter(
          (file) => !value.some((item) => item.id === file.id)
        )
        if (uniqueNewFiles.length) {
          onChange([...value, ...uniqueNewFiles])
        }
        setFiles((prev) => {
          const dedup = prev.filter((item) => !result.successFiles.some((sf) => sf.id === item.id))
          return [...result.successFiles, ...dedup]
        })
        resetUploadState()
        // 上传成功后关闭对话框
        setUploadDialogOpen(false)
      }
    } catch (error: any) {
      console.error("上传文件失败:", error)
      toast.error(error?.message || "上传文件失败")
    } finally {
      setUploading(false)
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        description: file.name.replace(/\.[^/.]+$/, ""),
      })),
    ])
  }

  return (
    <div className="space-y-4 border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconFiles className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">为课件添加可重复使用的资源文件</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="flex items-center gap-2">
                <IconPlus className="h-4 w-4" />
                绑定资源
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col p-6">
              <DialogHeader>
                <DialogTitle>绑定资源文件</DialogTitle>
                <DialogDescription>从资源库中挑选文件并关联到课件。</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Input
                    value={search}
                    onChange={handleSearchChange}
                    placeholder="搜索资源文件..."
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setFiles([])
                      setHasMoreTop(true)
                      setHasMoreBottom(true)
                      setLocalInitialLoading(true)
                      fetchData({ direction: "down", reset: true, customBeginID: "0" })
                    }}
                  >
                    <IconRefresh className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-auto border border-slate-200 rounded-lg p-3 min-h-0"
                  onScroll={search ? undefined : handleScroll}
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {localInitialLoading ? (
                    <div className="py-10 text-center text-sm text-slate-500">资源文件加载中...</div>
                  ) : (
                    <>
                      {search && searching && (
                        <div className="text-center text-xs text-slate-500 py-2">搜索中...</div>
                      )}
                      {search && !searching && files.length === 0 && (
                        <div className="text-center text-xs text-slate-500 py-2">无匹配文件</div>
                      )}
                      {loadingTop && <div className="text-center text-xs text-slate-500 py-2">加载中...</div>}
                      {!hasMoreTop && !search && (
                        <div className="text-center text-xs text-slate-500 py-2">已到顶部</div>
                      )}

                      {files.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {files.map((file) => {
                            const alreadyAdded = value.some((item) => item.id === file.id)
                            return (
                              <div
                                key={file.id}
                                className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md overflow-hidden flex flex-col"
                              >
                                <div className="flex items-center justify-center bg-slate-50 p-4">
                                  {renderPreviewThumb(file, 96)}
                                </div>
                                <div className="flex-1 px-4 py-3 space-y-2">
                                  <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                                    {file.description || `资源文件 #${file.id}`}
                                  </p>
                                  <div className="text-xs text-slate-500 space-y-1">
                                    <div>文件ID：{file.id}</div>
                                    <div>大小：{(file.size / 1024).toFixed(1)} KB</div>
                                    {file.tag_id ? <div>标签：{file.tag_id}</div> : null}
                                  </div>
                                </div>
                                <div className="px-4 pb-4">
                                  <Button
                                    size="sm"
                                    className="w-full"
                                    variant={alreadyAdded ? "outline" : "default"}
                                    disabled={alreadyAdded}
                                    onClick={() => handleAddFile(file)}
                                  >
                                    {alreadyAdded ? "已添加" : "添加"}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        !search && (
                          <div className="py-10 text-center text-sm text-slate-500">暂无资源，请先上传</div>
                        )
                      )}

                      {loadingBottom && <div className="text-center text-xs text-slate-500 py-2">加载中...</div>}
                      {!hasMoreBottom && !search && (
                        <div className="text-center text-xs text-slate-500 py-2">已到结尾</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {allowUpload && (
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <IconCloudUpload className="h-4 w-4" />
                  上传资源
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>上传新资源文件</DialogTitle>
                  <DialogDescription>选择文件上传到资源库，上传成功后自动关联到当前课件。</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <IconCloudUpload className="h-4 w-4 text-blue-500" />
                      上传新文件
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="upload-file-input"
                        className="flex items-center justify-between text-sm font-medium text-slate-700"
                      >
                        <span>选择文件（支持多选）</span>
                        <span className="text-xs text-slate-400">
                          {pendingFiles.length ? `已选择 ${pendingFiles.length} 个文件` : "尚未选择文件"}
                        </span>
                      </Label>
                      <input
                        ref={fileInputRef}
                        id="upload-file-input"
                        type="file"
                        multiple
                        onChange={handleFileInputChange}
                        disabled={uploading}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button
                          type="button"
                          variant="secondary"
                          className="bg-gradient-to-r from-blue-50 via-blue-100 to-indigo-50 text-blue-700 font-medium border border-dashed border-blue-300 shadow-sm hover:from-blue-100 hover:via-blue-200 hover:to-indigo-100 hover:text-blue-800 hover:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {pendingFiles.length ? "继续添加文件" : "选择文件"}
                        </Button>
                        {pendingFiles.length === 0 && (
                          <span className="text-sm text-slate-500">未选择任何文件</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        可一次选择多个文件。上传后可在下方调整名称或描述。
                      </p>
                    </div>
                  </div>

                  {pendingFiles.length > 0 && (
                    <div className="space-y-3">
                      {pendingFiles.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 space-y-3"
                        >
                          <div className="text-sm font-medium text-slate-700 truncate">
                            {item.file.name}（{(item.file.size / 1024).toFixed(1)} KB）
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-600">文件名称</Label>
                              <Input
                                value={item.name}
                                onChange={(e) =>
                                  setPendingFiles((prev) =>
                                    prev.map((entry) =>
                                      entry.id === item.id ? { ...entry, name: e.target.value } : entry
                                    )
                                  )
                                }
                                disabled={uploading}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-slate-600">文件描述</Label>
                              <Textarea
                                value={item.description}
                                rows={2}
                                onChange={(e) =>
                                  setPendingFiles((prev) =>
                                    prev.map((entry) =>
                                      entry.id === item.id ? { ...entry, description: e.target.value } : entry
                                    )
                                  )
                                }
                                disabled={uploading}
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() =>
                                setPendingFiles((prev) => prev.filter((entry) => entry.id !== item.id))
                              }
                              disabled={uploading}
                            >
                              移除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetUploadState}
                      disabled={uploading || pendingFiles.length === 0}
                    >
                      重置
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUpload}
                      disabled={uploading || pendingFiles.length === 0}
                    >
                      {uploading ? "上传中..." : `上传并关联 ${pendingFiles.length} 个文件`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {value.length === 0 ? (
          <p className="text-sm italic text-slate-500">尚未选择任何资源文件</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {value.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex-shrink-0">{renderPreviewThumb(file, 48)}</div>
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {file.description || `资源文件 #${file.id}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge variant="outline">ID: {file.id}</Badge>
                    <span>大小 {(file.size / 1024).toFixed(1)} KB</span>
                    {file.tag_id ? <span>标签 {file.tag_id}</span> : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(file.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

