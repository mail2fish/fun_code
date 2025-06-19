import * as React from "react"
import { IconDownload, IconTrash, IconFile, IconPhoto, IconMusic, IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { toast } from "sonner" 

import { HOST_URL } from "~/config";
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { fetchWithAuth } from "~/utils/api"

export interface FileItem {
  id: number
  name: string
  description: string
  size: number
  tag_id: number
  content_type: number
  original_name: string
}

interface FileTableProps {
  onDeleteFile?: (id: string) => Promise<void>
  filesApiUrl: string
  downloadApiUrl?: string
  showDeleteButton?: boolean
}

// 缓存相关常量
const CACHE_KEY = 'fileTableCacheV1';
const CACHE_EXPIRE = 60 * 60 * 1000; // 1小时

// 内容类型常量
const CONTENT_TYPE_IMAGE = 1;
const CONTENT_TYPE_AUDIO = 3;
const CONTENT_TYPE_SPRITE3 = 2;

export function FileTable({ 
  onDeleteFile,
  filesApiUrl,
  downloadApiUrl,
  showDeleteButton = true,
}: FileTableProps) {
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  
  // 先尝试从localStorage读取缓存
  const getInitialCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_EXPIRE) return null;
      return {
        beginID: 0, // 缓存 beginID 会产生一些奇怪的问题，暂时先禁用
        sortOrder: data.sortOrder,
      };
    } catch {
      return null;
    }
  };
  const initialCache = getInitialCache();
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">(initialCache?.sortOrder || "desc")

  // 无限滚动相关状态
  const [files, setFiles] = React.useState<FileItem[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const [totalFiles, setTotalFiles] = React.useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // 写入缓存
  const saveCache = React.useCallback((beginID: string) => {
    if (typeof window === 'undefined') return;

    let bID = parseInt(beginID)

    if (sortOrder === "asc" && bID > 0) {
      bID = bID - 1
    } else if (sortOrder === "desc" && bID > 0) {
      bID = bID + 1
    }
    beginID = bID.toString()

    const data = {
      beginID,
      sortOrder,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  }, [sortOrder]);

  // 文件名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!searchKeyword || searchKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setFiles([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() });
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/files/search?keyword=${encodeURIComponent(searchKeyword)}`);
        const data = await res.json();
        
        if (Array.isArray(data.data?.files)) {
          setFiles(data.data.files);
          setTotalFiles(data.data.files.length);
        } else {
          setFiles([]);
          setTotalFiles(0);
        }
        
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (error) {
        console.error("搜索文件失败:", error);
        setFiles([]);
        setTotalFiles(0);
        toast("搜索文件失败");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 监听排序变化，重置缓存并加载初始数据
  React.useEffect(() => {
    setFiles([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    saveCache((initialCache?.beginID || 0).toString());
    fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() })
    // eslint-disable-next-line
  }, [sortOrder])

  // 滚动监听
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop) {
      fetchData({ direction: "up" })
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom) {
      fetchData({ direction: "down" })
    }
  }

  // 数据请求
  async function fetchData({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) {
    const pageSize = 20
    let beginID = "0"
    let forward = true
    let asc = sortOrder === "asc"

    if (reset && customBeginID) {
      beginID = customBeginID;
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
      
      const res = await fetchWithAuth(`${filesApiUrl}?${params.toString()}`)
      const resp = await res.json()

      let newFiles: FileItem[] = [];
      if (Array.isArray(resp.data?.files)) {
        newFiles = resp.data.files;
      }

      // 设置总数
      if (resp.meta?.total !== undefined) {
        setTotalFiles(resp.meta.total);
      }

      if (reset) {
        setFiles(newFiles)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        // 缓存第一页的beginID
        if (newFiles.length > 0) {
          saveCache(newFiles[0].id.toString())
        } else {
          saveCache("0")
        }
        return
      }

      if (direction === "up") {
        if (newFiles.length === 0) setHasMoreTop(false)
        setFiles(prev => {
          const merged = [...newFiles, ...prev]
          let mergedFiles = merged.slice(0, 30)
          if (mergedFiles.length > 0) saveCache(mergedFiles[0].id.toString())
          return mergedFiles
        })
      } else {
        if (newFiles.length === 0) setHasMoreBottom(false)
        setFiles(prev => {
          const merged = [...prev, ...newFiles]
          let mergedFiles = merged.slice(-30)
          if (mergedFiles.length > 0) saveCache(mergedFiles[0].id.toString())
          return mergedFiles
        })
      }
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      setLocalInitialLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  const getFileIcon = (contentType: number) => {
    switch (contentType) {
      case CONTENT_TYPE_IMAGE:
        return <IconPhoto className="h-8 w-8 text-blue-500" />
      case CONTENT_TYPE_AUDIO:
        return <IconMusic className="h-8 w-8 text-green-500" />
      case CONTENT_TYPE_SPRITE3:
        return <IconFile className="h-8 w-8 text-purple-500" />
      default:
        return <IconFile className="h-8 w-8 text-gray-500" />
    }
  }

  const getContentTypeName = (contentType: number) => {
    switch (contentType) {
      case CONTENT_TYPE_IMAGE:
        return "图片"
      case CONTENT_TYPE_AUDIO:
        return "音频"
      case CONTENT_TYPE_SPRITE3:
        return "Scratch角色"
      default:
        return "其他"
    }
  }

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      // 如果指定了 downloadApiUrl，使用它并替换占位符；否则根据是否有删除权限推断API端点
      let apiUrl: string;
      if (downloadApiUrl) {
        apiUrl = downloadApiUrl.replace('{fileId}', fileId.toString());
      } else {
        apiUrl = showDeleteButton ? `/api/admin/files/${fileId}/download` : `/api/files/${fileId}/download`;
      }
      const response = await fetchWithAuth(`${HOST_URL}${apiUrl}`);
      if (!response.ok) throw new Error('下载失败');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast("文件下载成功");
    } catch (error) {
      toast("文件下载失败");
    }
  }

  // 删除后刷新当前缓存
  const handleDelete = async (id: number) => {
    if (!onDeleteFile) return;
    
    setDeletingId(id)
    try {
      await onDeleteFile(id.toString())
      setFiles(prev => prev.filter(f => f.id !== id))
      setTotalFiles(prev => prev - 1)
      toast("文件已成功删除")
    } catch (error) {
      toast("删除文件时出现错误")
    } finally {
      setDeletingId(null)
    }
  }

  if (localInitialLoading) {
    return <div className="text-center py-4">加载中...</div>
  }

  return (
    <div className="flex flex-col gap-2 h-[90vh]">
      <div className="flex items-center gap-2 px-2 sticky top-0 z-10 bg-white/80 backdrop-blur">
        {/* 文件名称搜索栏 */}
        <input
          className="w-48 h-8 px-3 border border-input rounded-md bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
          placeholder="搜索文件名称"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={{ boxSizing: 'border-box' }}
        />
        或 
        <Select value={sortOrder} onValueChange={v => {
              setSortOrder(v as "asc" | "desc")
              saveCache("0")
            }}> 
              <SelectTrigger className="w-28">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新优先</SelectItem>
                <SelectItem value="asc">最旧优先</SelectItem>
              </SelectContent>
            </Select>

        {/* 文件统计信息 */}
        <div className="text-sm text-muted-foreground">
          共 {totalFiles} 个文件
        </div>
        
        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm font-normal rounded-md border shadow-sm"
          onClick={() => {
            setFiles([])
            setHasMoreTop(true)
            setHasMoreBottom(true)
            setLocalInitialLoading(true)
            fetchData({ direction: "down", reset: true, customBeginID: "0" })
          }}
        >
          <IconRefresh className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onScroll={searchKeyword ? undefined : handleScroll}
      >
        {searchKeyword.length >= 1 && searching && (
          <div className="text-center text-xs text-muted-foreground py-2">搜索中...</div>
        )}
        {searchKeyword.length >= 1 && !searching && files.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">无匹配文件</div>
        )}
        {loadingTop && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreTop && <div className="text-center text-xs text-muted-foreground py-2">已到顶部</div>}
        
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {files.length > 0 ? (
            files.map((file) => (
              <Card key={file.id} className="flex flex-col h-full">
                <div className="w-full h-40 flex items-center justify-center rounded-t-xl bg-gray-50">
                  {file.content_type === CONTENT_TYPE_IMAGE || file.content_type === CONTENT_TYPE_SPRITE3 ? (
                    <img
                      src={`${HOST_URL}/api/files/${file.id}/preview`}
                      className="max-h-32 max-w-full object-contain"
                      alt="文件预览"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement?.appendChild(
                          Object.assign(document.createElement('div'), {
                            className: 'flex items-center justify-center h-32',
                            innerHTML: getFileIcon(file.content_type).props.children
                          })
                        );
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      {getFileIcon(file.content_type)}
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 flex-1">
                  <div className="text-xs text-muted-foreground">文件ID：{file.id}</div>
                  {file.description && (
                    <div className="font-medium text-base line-clamp-2" title={file.description}>
                      {file.description}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    类型：{getContentTypeName(file.content_type)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    大小：{formatFileSize(file.size)}
                  </div>
                  {file.tag_id > 0 && (
                    <div className="text-sm text-muted-foreground">
                      标签：{file.tag_id}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex items-center gap-0 px-1 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="下载"
                    className="py-0 min-h-0 h-auto px-1"
                    onClick={() => handleDownload(file.id, file.original_name)}
                  >
                    <IconDownload className="h-4 w-4 mr-1" />
                    下载
                  </Button>
                  {showDeleteButton && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="删除"
                          className="py-0 min-h-0 h-auto px-1"
                        >
                          <IconTrash className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认删除</DialogTitle>
                          <DialogDescription>
                            您确定要删除文件 "{file.original_name}" 吗？此操作无法撤销。
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDelete(file.id)}
                            disabled={deletingId === file.id}
                          >
                            {deletingId === file.id ? "删除中..." : "删除"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center text-muted-foreground py-12">没有找到文件</div>
          )}
        </div>
        
        {loadingBottom && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreBottom && <div className="text-center text-xs text-muted-foreground py-2">已到结尾</div>}
      </div>
    </div>
  )
} 