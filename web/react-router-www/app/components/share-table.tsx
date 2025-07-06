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

  // ========== requestInProgress 防并发 ========== 
  const requestInProgress = React.useRef(false);

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

  // 顶部自动检测，解决向上翻页 scroll 事件未触发的问题
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      if (container.scrollTop === 0 && hasMoreTop && !loadingTop) {
        fetchData({ direction: "up" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [shares.length, hasMoreTop, loadingTop]);

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
    if (requestInProgress.current) return;
    requestInProgress.current = true;
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
        setHasMoreTop(true)
        setHasMoreBottom(true)
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
        // 优先用 meta.has_next，否则用 newShares.length === pageSize
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreTop(!!resp.meta.has_next)
        } else {
          setHasMoreTop(newShares.length === pageSize)
        }
        // 向上翻页后允许再次向下翻页
        if (newShares.length > 0) setHasMoreBottom(true)
      } else {
        setShares(prev => [...prev, ...newShares])
        // 优先用 meta.has_next，否则用 newShares.length === pageSize
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreBottom(!!resp.meta.has_next)
        } else {
          setHasMoreBottom(newShares.length === pageSize)
        }
        // 向下翻页后允许再次向上翻页
        if (newShares.length > 0) setHasMoreTop(true)
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
      requestInProgress.current = false;
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
    const shareUrl = `${window.location.origin}/wwww/share/${shareToken}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast("分享链接已复制到剪贴板")
    } catch (error) {
      toast("复制失败，请手动复制链接")
    }
  }

  const handleOpenShare = (shareToken: string) => {
    const shareUrl = `/www/share/${shareToken}`
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
    <div className="flex flex-col gap-4 h-[90vh]">
      {/* 童趣化的搜索排序控件区域 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
        {/* 分享标题搜索栏 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🔍 搜索分享：</span>
          <input
            className="w-48 h-10 px-4 border-2 border-purple-200 rounded-2xl bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-300"
            placeholder="输入分享标题..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            style={{ boxSizing: 'border-box' }}
          />
        </div>
        
        <div className="flex items-center text-gray-400 text-sm">或</div>
        
        {/* 排序选择器 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📅 排序：</span>
          <Select value={sortOrder} onValueChange={v => {
                setSortOrder(v as "asc" | "desc")
                saveCache("0")
              }}> 
                <SelectTrigger className="w-32 rounded-xl border-2 border-purple-200 focus:border-purple-400">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">🆕 最新优先</SelectItem>
                  <SelectItem value="asc">⏰ 最旧优先</SelectItem>
                </SelectContent>
              </Select>
        </div>
        
        {/* 刷新按钮 */}
        <Button
          variant="outline"
          size="sm"
          className="h-10 px-4 text-sm font-medium rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-300"
          onClick={() => {
            setShares([])
            setHasMoreTop(true)
            setHasMoreBottom(true)
            setLocalInitialLoading(true)
            fetchData({ direction: "down", reset: true, customBeginID: "0" })
          }}
        >
          <IconRefresh className="h-4 w-4 mr-2" />
          🔄 刷新
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
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shares.length > 0 ? (
            shares.map((share) => {
              const author = userOptions.find(user => user.id === share.user_id?.toString())?.nickname || "未知作者";
              return (
                <Card key={share.id} className={`flex flex-col h-full rounded-2xl shadow-md border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-purple-400 hover:shadow-purple-200/50 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 ${!share.is_active ? 'bg-gray-50 border-gray-200 opacity-80 hover:opacity-90 hover:border-gray-400 hover:shadow-gray-200/50 hover:from-gray-50 hover:to-gray-100' : 'bg-white border-purple-200'}`}>
                  <div className="w-full h-48 flex items-center justify-center rounded-t-2xl bg-gradient-to-br from-purple-50 to-pink-50 relative overflow-hidden transition-all duration-300 hover:from-purple-100 hover:to-pink-100">
                    {/* 状态标识 */}
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${share.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {share.is_active ? '✅ 活跃' : '❌ 已停用'}
                    </div>
                    <a href={`${window.location.origin}/www/share/${share.share_token}`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={`${HOST_URL}/api/scratch/projects/${share.project_id}/thumbnail`}
                        className="max-h-40 object-contain transition-transform duration-300 hover:scale-110"
                        alt="项目缩略图"
                      />
                    </a>
                  </div>
                  <CardContent className="flex flex-col gap-2.5 flex-1 p-5">
                    <div className="text-xs text-purple-500 font-medium bg-purple-50 px-2 py-1 rounded-lg inline-block w-fit">
                      🎯 分享序号：{share.id}
                    </div>
                    <div className="font-bold text-xl text-gray-800 line-clamp-2 leading-tight group">
                      <a 
                        href={`${window.location.origin}/www/share/${share.share_token}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-purple-600 transition-all duration-200 group-hover:drop-shadow-sm"
                      >
                        {share.title || "未命名分享"}
                      </a>
                    </div>
                    {share.project_name && (
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <span className="text-blue-500">🎮</span>
                        <span className="font-medium">项目：</span>
                        <span>{share.project_name}</span>
                      </div>
                    )}
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                      <span className="text-green-500">👤</span>
                      <span className="font-medium">作者：</span>
                      <span>{author}</span>
                    </div>
                    {share.description && (
                      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500 text-base">💬</span>
                          <div className="line-clamp-3">{share.description}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-xl border border-orange-100">
                      <div className="flex items-center gap-1">
                        <span className="text-blue-500">👀</span>
                        <span className="font-medium text-gray-700">{share.view_count}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-red-500">❤️</span>
                        <span className="font-medium text-gray-700">{share.like_count}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <span className="text-purple-500">⏰</span>
                      <span className="font-medium">创建：</span>
                      <span>{formatDate(share.created_at)}</span>
                    </div>
                  </CardContent>
                                  <CardFooter className="p-5 pt-0 pb-5">
                    {share.is_active ? (
                      /* 分享激活时：显示所有按钮 */
                                              <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              title="复制链接"
                              onClick={() => handleCopyShareLink(share.share_token)}
                              className="flex-1 h-9 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 hover:scale-105 hover:shadow-md transition-all duration-200 font-medium text-sm"
                            >
                              <IconCopy className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:rotate-12" />
                              复制链接
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              title="打开分享"
                              onClick={() => handleOpenShare(share.share_token)}
                              className="flex-1 h-9 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 hover:scale-105 hover:shadow-md transition-all duration-200 font-medium text-sm"
                            >
                              <IconExternalLink className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:rotate-12" />
                              打开分享
                            </Button>
                          </div>
                        {showDeleteButton && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="关闭分享"
                                asChild
                                className="w-full h-9 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 hover:border-orange-300 transition-all duration-200 font-medium text-sm"
                              >
                                <a href='#'>
                                  <IconTrash className="h-4 w-4 mr-1" />
                                  关闭分享
                                </a>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-2xl">
                              <DialogHeader className="text-center pb-4">
                                <DialogTitle className="text-2xl font-bold text-orange-700 flex items-center justify-center gap-2">
                                  <span className="text-3xl">⚠️</span>
                                  确认关闭分享
                                </DialogTitle>
                                <DialogDescription className="text-gray-700 text-lg mt-4 bg-white/70 p-4 rounded-2xl border border-orange-100">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl">🤔</span>
                                    <div>
                                      您确定要关闭分享 <span className="font-semibold text-orange-800">"{share.title}"</span> 吗？
                                      <br />
                                      <span className="text-orange-600">关闭后该分享将无法访问。</span>
                                    </div>
                                  </div>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="flex gap-3 pt-4">
                                <DialogClose asChild>
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 h-12 rounded-2xl border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                  >
                                    <span className="mr-2">❌</span>
                                    取消
                                  </Button>
                                </DialogClose>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDelete(share.id)}
                                  disabled={deletingId === share.id}
                                  className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-2xl border-2 border-orange-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                  <span className="mr-2">🚫</span>
                                  {deletingId === share.id ? "关闭中..." : "关闭分享"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    ) : (
                      /* 分享已关闭时：显示重新分享和删除按钮 */
                                              <div className="flex gap-2 w-full">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="重新分享"
                                asChild
                                disabled={reactivatingId === share.id}
                                className="flex-1 h-9 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 font-medium text-sm"
                              >
                                <a href='#'>
                                  <IconShare className="h-4 w-4 mr-1" />
                                  {reactivatingId === share.id ? "激活中..." : "重新分享"}
                                </a>
                              </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-3xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-2xl">
                            <DialogHeader className="text-center pb-4">
                              <DialogTitle className="text-2xl font-bold text-blue-700 flex items-center justify-center gap-2">
                                <span className="text-3xl">🔄</span>
                                确认重新分享
                              </DialogTitle>
                              <DialogDescription className="text-gray-700 text-lg mt-4 bg-white/70 p-4 rounded-2xl border border-blue-100">
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl">✨</span>
                                  <div>
                                    您确定要重新激活分享 <span className="font-semibold text-blue-800">"{share.title}"</span> 吗？
                                    <br />
                                    <span className="text-blue-600">激活后该分享将重新可用。</span>
                                  </div>
                                </div>
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex gap-3 pt-4">
                              <DialogClose asChild>
                                <Button 
                                  variant="outline" 
                                  className="flex-1 h-12 rounded-2xl border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                  <span className="mr-2">❌</span>
                                  取消
                                </Button>
                              </DialogClose>
                              <Button 
                                onClick={() => handleReactivateShare(share)}
                                disabled={reactivatingId === share.id}
                                className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-2xl border-2 border-blue-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200"
                              >
                                <span className="mr-2">🚀</span>
                                {reactivatingId === share.id ? "激活中..." : "重新分享"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {showDeleteButton && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="删除分享"
                                asChild
                                className="flex-1 h-9 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 font-medium text-sm"
                              >
                                <a href='#'>
                                  <IconTrash className="h-4 w-4 mr-1" />
                                  删除分享
                                </a>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 shadow-2xl">
                              <DialogHeader className="text-center pb-4">
                                <DialogTitle className="text-2xl font-bold text-red-700 flex items-center justify-center gap-2">
                                  <span className="text-3xl">🗑️</span>
                                  确认删除分享
                                </DialogTitle>
                                <DialogDescription className="text-gray-700 text-lg mt-4 bg-white/70 p-4 rounded-2xl border border-red-100">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl">⚠️</span>
                                    <div>
                                      您确定要删除分享 <span className="font-semibold text-red-800">"{share.title}"</span> 吗？
                                      <br />
                                      <span className="text-red-600 font-medium">此操作无法撤销。</span>
                                    </div>
                                  </div>
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="flex gap-3 pt-4">
                                <DialogClose asChild>
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 h-12 rounded-2xl border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                  >
                                    <span className="mr-2">❌</span>
                                    取消
                                  </Button>
                                </DialogClose>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDelete(share.id)}
                                  disabled={deletingId === share.id}
                                  className="flex-1 h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-2xl border-2 border-red-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                  <span className="mr-2">💥</span>
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