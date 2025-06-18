import * as React from "react"
import { IconShare, IconTrash, IconEye, IconRefresh, IconCopy, IconExternalLink } from "@tabler/icons-react"

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

export interface ShareItem {
  id: number
  share_token: string
  project_id: number
  project_type: number
  title: string
  description: string
  view_count: number
  total_view_count: number
  max_views: number
  is_active: boolean
  allow_download: boolean
  allow_remix: boolean
  like_count: number
  created_at: string
  updated_at: string
  project_name?: string
  user_id?: number
}

export interface User {
  id: string
  nickname: string
}

interface ShareTableProps {
  onDeleteShare?: (id: string) => Promise<void>
  sharesApiUrl: string
  showDeleteButton?: boolean
}

// 缓存相关常量
const CACHE_KEY = 'shareTableCacheV1';
const CACHE_EXPIRE = 60 * 60 * 1000; // 1小时

export function ShareTable({ 
  onDeleteShare,
  sharesApiUrl,
  showDeleteButton = false,
}: ShareTableProps) {
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [reactivatingId, setReactivatingId] = React.useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [userOptions, setUserOptions] = React.useState<User[]>([]);
  
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
  const [shares, setShares] = React.useState<ShareItem[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
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

  // 分享标题搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!searchKeyword || searchKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setShares([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() });
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        // 这里可以添加分享搜索API调用
        // 暂时先显示所有分享
        setShares([]);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (e) {
        setShares([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 监听排序变化，重置缓存并加载初始数据
  React.useEffect(() => {
    setShares([])
    setUserOptions([]) // 清空用户选项
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
    } else if (!reset && shares.length > 0) {
      if (direction === "up") {
        beginID = shares[0].id.toString()
        forward = false
      } else {
        beginID = shares[shares.length - 1].id.toString()
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
      
      const res = await fetchWithAuth(`${sharesApiUrl}?${params.toString()}`)
      const resp = await res.json()

      let newShares: ShareItem[] = [];
      if (Array.isArray(resp.data?.shares)) {
        newShares = resp.data.shares;
      }

      // 更新用户信息
      if (Array.isArray(resp.data?.users)) {
        const newUsers: User[] = resp.data.users.map((user: any) => ({
          id: user.id.toString(),
          nickname: user.nickname || user.username || `用户${user.id}`
        }));
        
        // 合并新用户信息，避免重复
        setUserOptions(prev => {
          const existingIds = new Set(prev.map(u => u.id));
          const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.id));
          return [...prev, ...uniqueNewUsers];
        });
      }

      if (reset) {
        setShares(newShares)
        setHasMoreTop(newShares.length === pageSize)
        setHasMoreBottom(newShares.length === pageSize)
        // 重置时清空用户选项，避免过期数据
        if (Array.isArray(resp.data?.users)) {
          const resetUsers: User[] = resp.data.users.map((user: any) => ({
            id: user.id.toString(),
            nickname: user.nickname || user.username || `用户${user.id}`
          }));
          setUserOptions(resetUsers);
        }
      } else if (direction === "up") {
        setShares(prev => [...newShares, ...prev])
        setHasMoreTop(newShares.length === pageSize)
      } else {
        setShares(prev => [...prev, ...newShares])
        setHasMoreBottom(newShares.length === pageSize)
      }

      if (newShares.length > 0) {
        saveCache(reset ? (customBeginID || "0") : beginID);
      }
    } catch (error) {
      console.error("获取分享列表失败:", error)
      toast("获取分享列表失败")
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      setLocalInitialLoading(false)
    }
  }


  // 初始加载
  React.useEffect(() => {
    fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() })
    // eslint-disable-next-line
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCopyShareLink = async (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast("分享链接已复制到剪贴板")
    } catch (error) {
      toast("复制失败，请手动复制链接")
    }
  }

  const handleOpenShare = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/shares/${shareToken}`
    window.open(shareUrl, '_blank')
  }

  const handleDelete = async (id: number) => {
    const share = shares.find(s => s.id === id)
    if (!share) return

    if (onDeleteShare) {
      setDeletingId(id)
      try {
        await onDeleteShare(id.toString())
        
        if (share.is_active) {
          // 关闭分享：不从列表删除，只显示成功消息
          toast("分享已关闭")
          // 可以选择刷新列表以获取最新状态
          window.location.reload()
        } else {
          // 删除分享：从列表中移除
          setShares(prev => prev.filter(share => share.id !== id))
          toast("分享删除成功")
        }
      } catch (error) {
        toast(share.is_active ? "关闭分享失败" : "删除分享失败")
      } finally {
        setDeletingId(null)
      }
    }
  }

  // 重新激活分享
  const handleReactivateShare = async (share: ShareItem) => {
    setReactivatingId(share.id)
    try {
      const shareData = {
        project_id: share.project_id,
        project_type: share.project_type,
        title: share.title,
        description: share.description,
        max_views: share.max_views,
        allow_download: share.allow_download,
        allow_remix: share.allow_remix,
      }

      console.log("重新激活分享，发送到API的数据:", shareData)

      const res = await fetchWithAuth(`${HOST_URL}/api/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shareData),
      })

      const result = await res.json()
      console.log("重新激活分享API响应:", result)
      
      // 检查是否成功：HTTP状态OK且有data字段
      if (res.ok && result.data && result.data.share_token) {
        toast("分享已重新激活")
        // 刷新页面以获取最新状态
        window.location.reload()
      } else {
        console.error("重新激活分享失败:", result)
        const errorMessage = result.message || result.error || "未知错误"
        toast(`重新激活分享失败：${errorMessage}`)
      }
    } catch (error) {
      console.error("重新激活分享时出错：", error)
      toast("重新激活分享时出现网络错误")
    } finally {
      setReactivatingId(null)
    }
  }

  if (localInitialLoading) {
    return <div className="text-center py-4">加载中...</div>
  }

  return (
    <div className="flex flex-col gap-2 h-[90vh]">
      <div className="flex items-center gap-2 px-2 sticky top-0 z-10 bg-white/80 backdrop-blur">
        {/* 分享标题搜索栏 */}
        <input
          className="w-48 h-8 px-3 border border-input rounded-md bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
          placeholder="搜索分享标题"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={{ boxSizing: 'border-box' }}
        />

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
        
        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm font-normal rounded-md border shadow-sm"
          onClick={() => {
            setShares([])
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
        {searchKeyword.length >= 1 && !searching && shares.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">无匹配分享</div>
        )}
        {loadingTop && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreTop && <div className="text-center text-xs text-muted-foreground py-2">已到顶部</div>}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {shares.length > 0 ? (
            shares.map((share) => {
              const author = userOptions.find(user => user.id === share.user_id?.toString())?.nickname || "未知作者";
              return (
                <Card key={share.id} className={`flex flex-col h-full ${!share.is_active ? 'bg-gray-100 opacity-75' : ''}`}>
                  <div className="w-full h-40 flex items-center justify-center rounded-t-xl bg-gray-50">
                    <a href={`${window.location.origin}/share/${share.share_token}`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={`${HOST_URL}/api/scratch/projects/${share.project_id}/thumbnail`}
                        className="max-h-32 object-contain"
                        alt="项目缩略图"
                      />
                    </a>
                  </div>
                  <CardContent className="flex flex-col gap-2 flex-1">
                    <div className="text-xs text-muted-foreground">分享序号：{share.id}</div>
                    <div className="font-medium text-base line-clamp-1">
                      <a 
                        href={`${window.location.origin}/share/${share.share_token}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {share.title || "未命名分享"}
                      </a>
                    </div>
                    {share.project_name && (
                      <div className="text-sm text-muted-foreground">项目：{share.project_name}</div>
                    )}
                    <div className="text-sm text-muted-foreground">作者：{author}</div>
                    {share.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">{share.description}</div>
                    )}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>👀 {share.view_count}</span>
                      <span>❤️ {share.like_count}</span>
                      <div className={`text-xs font-medium ${share.is_active ? "text-green-600" : "text-red-600"}`}>
                        {share.is_active ? "活跃" : "已停用"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">创建时间：{formatDate(share.created_at)}</div>
                  </CardContent>
                                  <CardFooter className="flex flex-col gap-1 px-1 py-1">
                    {share.is_active ? (
                      /* 分享激活时：显示所有按钮 */
                      <div className="flex items-center justify-center gap-0 w-full">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="复制链接"
                          onClick={() => handleCopyShareLink(share.share_token)}
                          className="py-0 min-h-0 h-auto px-2 flex-1"
                        >
                          <IconCopy className="h-4 w-4 mr-1" />
                          复制链接
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="打开分享"
                          onClick={() => handleOpenShare(share.share_token)}
                          className="py-0 min-h-0 h-auto px-2 flex-1"
                        >
                          <IconExternalLink className="h-4 w-4 mr-1" />
                          打开分享
                        </Button>
                        {showDeleteButton && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="关闭分享"
                                asChild
                                className="py-0 min-h-0 h-auto px-2 flex-1 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                              >
                                <a href='#'>
                                  <IconTrash className="h-4 w-4 mr-1" />
                                  关闭分享
                                </a>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认关闭分享</DialogTitle>
                                <DialogDescription>
                                  您确定要关闭分享 "{share.title}" 吗？关闭后该分享将无法访问。
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDelete(share.id)}
                                  disabled={deletingId === share.id}
                                  className="bg-gray-600 hover:bg-gray-700"
                                >
                                  {deletingId === share.id ? "关闭中..." : "关闭分享"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : (
                      /* 分享已关闭时：显示重新分享和删除按钮 */
                      <div className="flex items-center justify-center gap-0 w-full">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="重新分享"
                              asChild
                              disabled={reactivatingId === share.id}
                              className="py-0 min-h-0 h-auto px-2 flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <a href='#'>
                                <IconShare className="h-4 w-4 mr-1" />
                                {reactivatingId === share.id ? "激活中..." : "重新分享"}
                              </a>
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>确认重新分享</DialogTitle>
                              <DialogDescription>
                                您确定要重新激活分享 "{share.title}" 吗？激活后该分享将重新可用。
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">取消</Button>
                              </DialogClose>
                                                             <Button 
                                 onClick={() => handleReactivateShare(share)}
                                 disabled={reactivatingId === share.id}
                                 className="bg-blue-600 hover:bg-blue-700"
                               >
                                {reactivatingId === share.id ? "激活中..." : "重新分享"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {showDeleteButton && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="删除分享"
                                asChild
                                className="py-0 min-h-0 h-auto px-2 flex-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              >
                                <a href='#'>
                                  <IconTrash className="h-4 w-4 mr-1" />
                                  删除分享
                                </a>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认删除分享</DialogTitle>
                                <DialogDescription>
                                  您确定要删除分享 "{share.title}" 吗？此操作无法撤销。
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDelete(share.id)}
                                  disabled={deletingId === share.id}
                                  className="bg-purple-600 hover:bg-purple-700"
                                >
                                  {deletingId === share.id ? "删除中..." : "删除分享"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              )
            })
          ) : (
            <div className="col-span-full text-center text-muted-foreground py-12">没有找到分享记录</div>
          )}
        </div>
        {loadingBottom && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreBottom && <div className="text-center text-xs text-muted-foreground py-2">已到结尾</div>}
      </div>
    </div>
  )
} 