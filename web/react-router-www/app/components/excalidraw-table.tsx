import * as React from "react"
import { IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react"

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

import { toast } from  "sonner" 

import { HOST_URL } from "~/config";
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { fetchWithAuth } from "~/utils/api"

// Excalidraw 画板接口
export interface ExcalidrawBoard {
  id: string
  name: string
  user_id: string
  created_at?: string
  updated_at?: string
}

// 用户接口
export interface User {
  id: string
  nickname: string
}

// 画板数据接口
export interface ExcalidrawBoardsData {
  boards: ExcalidrawBoard[]
  total: number
  has_next: boolean
  pageSize: number
}

interface ExcalidrawTableProps {
  onDeleteBoard: (id: string) => Promise<void>
  isAdminPage?: boolean
}

export function ExcalidrawTable({ 
  onDeleteBoard,
  isAdminPage = false
}: ExcalidrawTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  
  // 用户筛选相关状态
  const [userOptions, setUserOptions] = React.useState<User[]>([])
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<User[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<string>("__all__")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  const [boardKeyword, setBoardKeyword] = React.useState("")
  const [searchingBoard, setSearchingBoard] = React.useState(false)
  
  // 无限滚动相关状态
  const [boards, setBoards] = React.useState<ExcalidrawBoard[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // ========== requestInProgress 防并发 ========== 
  const requestInProgress = React.useRef(false);

  // 获取用户列表 - 仅在管理页面且需要用户筛选时才调用
  React.useEffect(() => {
    if (!isAdminPage) return;
    
    async function fetchUsers() {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?pageSize=100`);
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setUserOptions(data.data)
        }
      } catch (e) {}
    }
    fetchUsers()
  }, [isAdminPage])

  // 搜索用户（带防抖）- 仅在管理页面且需要用户筛选时才调用
  React.useEffect(() => {
    if (!isAdminPage || !searchKeyword) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/search?keyword=${encodeURIComponent(searchKeyword)}&user_id=${selectedUser}`);
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setSearchResults(data.data);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, isAdminPage]);

  // 监听筛选用户和排序变化，重置并加载初始数据
  React.useEffect(() => {
    setBoards([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    // 初始化、刷新、排序切换时，强制 direction='down'，beginID='0'
    fetchData({ direction: "down", reset: true, customBeginID: "0" })
    // eslint-disable-next-line
  }, [selectedUser, sortOrder])

  // 画板名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!boardKeyword || boardKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setBoards([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      // 这里也强制 direction='down'，beginID='0'
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
      return;
    }
    setSearchingBoard(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append("keyword", boardKeyword);
        if (selectedUser && selectedUser !== "__all__") params.append("userID", selectedUser);
        
        // 使用新的搜索API
        const res = await fetchWithAuth(`${HOST_URL}/api/excalidraw/boards/search?${params.toString()}`);
        const data = await res.json();
        let newBoards: ExcalidrawBoard[] = [];
        if (Array.isArray(data.data)) {
          newBoards = data.data;
        }
        setBoards(newBoards);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (e) {
        setBoards([]);
      } finally {
        setSearchingBoard(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [boardKeyword, selectedUser]);

  // 数据请求
  const fetchData = React.useCallback(async ({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) => {
    if (requestInProgress.current) {
      console.log('[fetchData] 请求被并发保护拦截', { direction, reset, customBeginID });
      return;
    }
    requestInProgress.current = true;
    console.log('[fetchData] 开始请求', { direction, reset, customBeginID });
    
    const pageSize = 20;
    let beginID = "0";
    let forward = true;
    let asc = sortOrder === "asc";
    let userId = selectedUser === "__all__" ? undefined : selectedUser;
    
    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && boards.length > 0) {
      if (direction === "up") {
        beginID = boards[0].id;
        forward = false;
      } else {
        beginID = boards[boards.length - 1].id;
        forward = true;
      }
    }
    
    if (direction === "up") setLoadingTop(true);
    if (direction === "down") setLoadingBottom(true);
    
    try {
      const params = new URLSearchParams();
      params.append("pageSize", String(pageSize));
      params.append("forward", String(forward));
      params.append("asc", String(asc));
      if (beginID !== "0") params.append("beginID", beginID);
      if (userId) params.append("userID", userId);
      
      // 根据是否为管理页面选择不同的API
      const apiUrl = isAdminPage 
        ? `${HOST_URL}/api/excalidraw/boards/all?${params.toString()}`
        : `${HOST_URL}/api/excalidraw/boards?${params.toString()}`;
      
      const res = await fetchWithAuth(apiUrl);
      const resp = await res.json();
      console.log('[fetchData] API响应', resp);
      
      // 处理返回数据
      let newBoards: ExcalidrawBoard[] = [];
      if (Array.isArray(resp.data)) {
        newBoards = resp.data;
      }
      
      if (reset) {
        setBoards(newBoards)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        return
      }
      
      if (direction === "up") {
        if (newBoards.length === 0) setHasMoreTop(false)
        setBoards(prev => {
          const merged = [...newBoards, ...prev]
          let mergedBoards = merged.slice(0, 30)
          return mergedBoards
        })
        // 只在向上翻页时根据API meta.has_next设置 hasMoreTop
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreTop(!!resp.meta.has_next)
        }
        // 向上翻页后允许再次向下翻页
        if (newBoards.length > 0) setHasMoreBottom(true)
      } else if (direction === "down") {
        if (newBoards.length === 0) setHasMoreBottom(false)
        setBoards(prev => {
          const merged = [...prev, ...newBoards]
          let mergedBoards = merged.slice(-30)
          return mergedBoards
        })
        // 只在向下翻页时根据API meta.has_next设置 hasMoreBottom
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreBottom(!!resp.meta.has_next)
        }
        // 向下翻页后允许再次向上翻页
        if (newBoards.length > 0) setHasMoreTop(true)
      }
    } catch (error) {
      console.error('[fetchData] 请求失败', error);
      toast("获取数据失败，请重试");
    } finally {
      requestInProgress.current = false;
      if (direction === "up") setLoadingTop(false);
      if (direction === "down") setLoadingBottom(false);
      setLocalInitialLoading(false);
      console.log('[fetchData] 请求结束', { direction });
    }
  }, [boards, isAdminPage, selectedUser, sortOrder]);

  // 初始化数据
  React.useEffect(() => {
    fetchData({ direction: "down", reset: true, customBeginID: "0" })
  }, []);

  // 滚动事件处理
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
      fetchData({ direction: "up" });
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
      fetchData({ direction: "down" });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知日期"
    
    try {
      const date = new Date(dateString)
      
      if (isNaN(date.getTime())) {
        return "未知日期"
      }
      
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
    } catch (error) {
      return "日期格式错误"
    }
  }

  // 删除后刷新当前缓存
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDeleteBoard(id)
      setBoards(prev => prev.filter(p => p.id !== id))
      toast("画板已成功删除")
    } catch (error) {
      toast("删除画板时出现错误")
    } finally {
      setDeletingId(null)
    }
  }

  // 刷新数据
  const handleRefresh = () => {
    setBoardKeyword("") // 清空搜索
    setBoards([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    fetchData({ direction: "down", reset: true, customBeginID: "0" })
  }

  return (
    <div className="flex flex-col gap-4 h-[90vh]">
      {/* 童趣化的搜索排序控件区域 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-teal-50 rounded-2xl border-2 border-blue-200">
        {/* 用户筛选和排序 */}
        {isAdminPage && userOptions.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">👤 筛选用户：</span>
              <Select value={selectedUser} onValueChange={(value) => {
                setSelectedUser(value)
                setSearchKeyword(""); // 选择后清空搜索
              }}>
                <SelectTrigger className="w-40 rounded-xl border-2 border-blue-200 focus:border-blue-400">
                  <SelectValue placeholder="全部用户" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1">
                    <input
                      className="w-full outline-none bg-transparent text-sm px-2 py-1 border rounded-md h-8"
                      placeholder="搜索用户"
                      value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <SelectItem value="__all__">全部用户</SelectItem>
                  {(searchKeyword ? searchResults : userOptions).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nickname}</SelectItem>
                  ))}
                  {searching && <div className="px-2 py-1 text-xs text-muted-foreground">搜索中...</div>}
                  {searchKeyword && !searching && searchResults.length === 0 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">无匹配用户</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        
        {/* 画板名称搜索栏 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🔍 搜索流程图：</span>
          <input
            className="w-48 h-10 px-4 border-2 border-blue-200 rounded-2xl bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all duration-300"
            placeholder="输入流程图名称..."
            value={boardKeyword}
            onChange={e => setBoardKeyword(e.target.value)}
            style={{ boxSizing: 'border-box' }}
          />
        </div>
        
        <div className="flex items-center text-gray-400 text-sm">或</div>
        
        {/* 排序选择器 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">📅 排序：</span>
          <Select value={sortOrder} onValueChange={v => {
                setSortOrder(v as "asc" | "desc")
              }}> 
                <SelectTrigger className="w-32 rounded-xl border-2 border-blue-200 focus:border-blue-400">
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
          className="h-10 px-4 text-sm font-medium rounded-2xl border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition-all duration-300"
          onClick={handleRefresh}
          disabled={localInitialLoading}
        >
          <IconRefresh className="h-4 w-4 mr-2" />
          🔄 刷新
        </Button>
      </div>

      {/* 画板卡片列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onScroll={boardKeyword ? undefined : handleScroll}
      >
        {boardKeyword.length >= 1 && searchingBoard && (
          <div className="text-center text-xs text-muted-foreground py-2">搜索中...</div>
        )}
        {boardKeyword.length >= 1 && !searchingBoard && boards.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">无匹配流程图</div>
        )}
        {localInitialLoading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : (
          <>
            {loadingTop && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
            {!hasMoreTop && <div className="text-center text-xs text-muted-foreground py-2">已到顶部</div>}
            
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {boards.length > 0 ? (
                boards.map((board) => {
                  const creator = userOptions.find(user => user.id === board.user_id)?.nickname || "未知";
                  return (
                  <Card key={board.id} className="flex flex-col h-full rounded-2xl shadow-md border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-blue-400 hover:shadow-blue-200/50 hover:bg-gradient-to-br hover:from-blue-50 hover:to-teal-50 bg-white border-blue-200">
                    {/* 缩略图区域 */}
                    <div className="w-full h-48 flex items-center justify-center rounded-t-2xl bg-gradient-to-br from-blue-50 to-teal-50 relative overflow-hidden transition-all duration-300 hover:from-blue-100 hover:to-teal-100">
                      <a href={`${HOST_URL}/excalidraw/open/${board.id}`}>
                        <img
                          src={`${HOST_URL}/api/excalidraw/boards/${board.id}/thumbnail`}
                          className="max-h-40 object-contain transition-transform duration-300 hover:scale-110"
                          alt="流程图缩略图"
                          onError={(e) => {
                            // 如果缩略图加载失败，显示默认图标
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `
                              <div class="w-32 h-32 flex items-center justify-center bg-white rounded-2xl shadow-inner border-2 border-dashed border-blue-300">
                                <svg class="w-16 h-16 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                              </div>
                              <div class="absolute bottom-2 left-2 right-2 text-center">
                                <span class="text-xs text-blue-600 bg-white/80 px-2 py-1 rounded-lg">🎨 流程图</span>
                              </div>
                            `;
                          }}
                        />
                      </a>
                    </div>
                    
                    <CardContent className="flex flex-col gap-2.5 flex-1 p-5">
                      <div className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-1 rounded-lg inline-block w-fit">
                        🎯 画板序号：{board.id}
                      </div>
                      <div className="font-bold text-xl text-gray-800 line-clamp-2 leading-tight group">
                        <a 
                          href={`${HOST_URL}/excalidraw/open/${board.id}`}
                          className="hover:text-blue-600 transition-all duration-200 group-hover:drop-shadow-sm"
                        >
                          {board.name || "未命名流程图"}
                        </a>
                      </div>
                      {isAdminPage && userOptions.length > 0 && (
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <span className="text-green-500">👤</span>
                          <span className="font-medium">创建者：</span>
                          <span>{creator}</span>
                        </div>
                      )}
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <span className="text-blue-500">⏰</span>
                        <span className="font-medium">创建：</span>
                        <span>{formatDate(board.created_at)}</span>
                      </div>
                      {board.updated_at && board.updated_at !== board.created_at && (
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <span className="text-teal-500">🔄</span>
                          <span className="font-medium">更新：</span>
                          <span>{formatDate(board.updated_at)}</span>
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter className="p-5 pt-0 pb-5">
                      <div className="flex flex-col gap-2 w-full">
                        {/* 第一行：编辑按钮 */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            title="编辑"
                            asChild
                            className="flex-1 h-9 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 hover:scale-105 hover:shadow-md transition-all duration-200 font-medium text-sm group"
                          >
                            <a href={`${HOST_URL}/excalidraw/open/${board.id}`}>
                              <IconEdit className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:rotate-12" />
                              编辑流程图
                            </a>
                          </Button>
                        </div>
                        
                        {/* 第二行：删除按钮 */}
                        <div className="flex gap-2 w-full">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                title="删除"
                                asChild
                                className="flex-1 h-9 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 font-medium text-sm"
                              >
                                <a href='#'>
                                  <IconTrash className="h-4 w-4 mr-1" />
                                  删除
                                </a>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 shadow-2xl">
                              <DialogHeader className="text-center pb-4">
                                <DialogTitle className="text-2xl font-bold text-red-700 flex items-center justify-center gap-2">
                                  <span className="text-3xl">⚠️</span>
                                  确认删除流程图
                                </DialogTitle>
                                <DialogDescription className="text-gray-700 text-lg mt-4 bg-white/70 p-4 rounded-2xl border border-red-100">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl">🤔</span>
                                    <div>
                                      您确定要删除流程图 <span className="font-semibold text-red-800">"{board.name || "未命名流程图"}"</span> 吗？
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
                                  onClick={() => handleDelete(board.id)}
                                  disabled={deletingId === board.id}
                                  className="flex-1 h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-2xl border-2 border-red-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                  <span className="mr-2">💥</span>
                                  {deletingId === board.id ? "删除中..." : "删除流程图"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                  )
                })
              ) : (
                <div className="col-span-full text-center text-muted-foreground py-12">没有找到流程图</div>
              )}
            </div>
            
            {loadingBottom && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
            {!hasMoreBottom && <div className="text-center text-xs text-muted-foreground py-2">已到结尾</div>}
          </>
        )}
      </div>
    </div>
  )
}
