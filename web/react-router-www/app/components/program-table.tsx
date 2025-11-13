import * as React from "react"
import { IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconHistory, IconRefresh, IconShare, IconCode } from "@tabler/icons-react"

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

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { fetchWithAuth } from "~/utils/api"

export interface Program {
  id: string
  name: string
  user_id: string
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  ext?: number
}

export interface User {
  id: string
  nickname: string
}

export interface ProgramsData{
  programs: Program[]
  users: User[]
  total: number
  showForward:boolean
  showBackward:boolean 
  pageSize: number
  currentPage: number
}

interface ProgramTableProps {
  programsData?: ProgramsData
  isLoading?: boolean
  onDeleteProgram: (id: string) => Promise<void>
  showUserFilter?: boolean
  programsApiUrl: string
}

export function ProgramTable({ 
  onDeleteProgram,
  showUserFilter = false,
  programsApiUrl,
}: ProgramTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [userOptions, setUserOptions] = React.useState<User[]>([])
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<User[]>([]);
  const [programKeyword, setProgramKeyword] = React.useState("");
  const [searchingProgram, setSearchingProgram] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<string>("__all__")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")

  // 无限滚动相关状态
  const [programs, setPrograms] = React.useState<Program[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // 获取用户列表 - 仅在需要用户筛选时才调用
  React.useEffect(() => {
    if (!showUserFilter) return;
    
    async function fetchUsers() {
      try {
        const res = await fetchWithAuth(`/api/admin/users/list?pageSize=100`);
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setUserOptions(data.data)
        }
      } catch (e) {}
    }
    fetchUsers()
  }, [showUserFilter])

  // 搜索用户（带防抖）- 仅在需要用户筛选时才调用
  React.useEffect(() => {
    if (!showUserFilter || !searchKeyword) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`/api/admin/users/search?keyword=${encodeURIComponent(searchKeyword)}&user_id=${selectedUser}`);
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
  }, [searchKeyword, showUserFilter]);

  // 监听筛选用户和排序变化，重置并加载初始数据
  React.useEffect(() => {
    setPrograms([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    // 初始化、刷新、排序切换时，强制 direction='down'，beginID='0'
    fetchData({ direction: "down", reset: true, customBeginID: "0" })
    // eslint-disable-next-line
  }, [selectedUser, sortOrder])

  // 程序名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!programKeyword || programKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setPrograms([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      // 这里也强制 direction='down'，beginID='0'
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
      return;
    }
    setSearchingProgram(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append("keyword", programKeyword);
        if (selectedUser && selectedUser !== "__all__") params.append("userId", selectedUser);
        const res = await fetchWithAuth(`/api/admin/programs/search?${params.toString()}`);
        const data = await res.json();
        let newPrograms: Program[] = [];
        if (Array.isArray(data.data)) {
          newPrograms = data.data;
        } else if (Array.isArray(data.data?.programs)) {
          newPrograms = data.data.programs;
        }
        setPrograms(newPrograms);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (e) {
        setPrograms([]);
      } finally {
        setSearchingProgram(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [programKeyword, selectedUser]);

  // ====== 以下滚动到顶自动加载机制已从 list_lessons.tsx 迁移 ======
  // 1. 原生 scroll 事件监听，确保即使 React onScroll 未触发也能加载
  // 2. 顶部位置自动检测，数据变化后自动判断是否需要加载更多
  // 3. 兼容原有 handleScroll 逻辑
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const nativeScrollHandler = (e: Event) => {
      const target = e.target as HTMLDivElement;
      console.log('[原生scroll事件]', {
        scrollTop: target.scrollTop,
        hasMoreTop,
        loadingTop,
        requestInProgress: requestInProgress?.current
      });
      if (target.scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress?.current) {
        console.log('[原生scroll事件] 触发顶部加载 fetchData(up)');
        fetchData({ direction: "up" });
      }
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress?.current) {
        console.log('[原生scroll事件] 触发底部加载 fetchData(down)');
        fetchData({ direction: "down" });
      }
    };
    container.addEventListener('scroll', nativeScrollHandler, { passive: true });
    return () => {
      container.removeEventListener('scroll', nativeScrollHandler);
    };
  }, [hasMoreTop, hasMoreBottom, loadingTop, loadingBottom, fetchData]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      console.log('[顶部自动检测]', {
        scrollTop: container.scrollTop,
        hasMoreTop,
        loadingTop,
        requestInProgress: requestInProgress?.current
      });
      if (container.scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress?.current) {
        console.log('[顶部自动检测] 触发顶部加载 fetchData(up)');
        fetchData({ direction: "up" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [programs.length, hasMoreTop, loadingTop, fetchData]);

  // 兼容原有 onScroll 逻辑（如有需要）
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    console.log('[onScroll事件]', {
      scrollTop: el.scrollTop,
      hasMoreTop,
      loadingTop,
      requestInProgress: requestInProgress?.current
    });
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress?.current) {
      console.log('[onScroll事件] 触发顶部加载 fetchData(up)');
      fetchData({ direction: "up" });
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress?.current) {
      console.log('[onScroll事件] 触发底部加载 fetchData(down)');
      fetchData({ direction: "down" });
    }
  };

  // ========== requestInProgress 防并发 ========== 
  const requestInProgress = React.useRef(false);

  // 数据请求
  async function fetchData({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) {
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
    } else if (!reset && programs.length > 0) {
      if (direction === "up") {
        beginID = programs[0].id;
        forward = false;
      } else {
        beginID = programs[programs.length - 1].id;
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
      if (userId) params.append("userId", userId);
      const res = await fetchWithAuth(`${programsApiUrl}?${params.toString()}`);
      const resp = await res.json();
      console.log('[fetchData] API响应', resp);
      // 兼容不同接口返回结构
      let newPrograms: Program[] = [];
      if (Array.isArray(resp.data)) {
        newPrograms = resp.data;
      } else if (Array.isArray(resp.data.programs)) {
        newPrograms = resp.data.programs;
      } else {
        newPrograms = [];
      }
      if (reset) {
        setPrograms(newPrograms)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        return
      }
      if (direction === "up") {
        if (newPrograms.length === 0) setHasMoreTop(false)
        setPrograms(prev => {
          const merged = [...newPrograms, ...prev]
          let mergedPrograms = merged.slice(0, 30)
          return mergedPrograms
        })
        // 只在向上翻页时根据API meta.has_next设置 hasMoreTop
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreTop(!!resp.meta.has_next)
        }
        // 向上翻页后允许再次向下翻页
        if (newPrograms.length > 0) setHasMoreBottom(true)
      } else if (direction === "down") {
        if (newPrograms.length === 0) setHasMoreBottom(false)
        setPrograms(prev => {
          const merged = [...prev, ...newPrograms]
          let mergedPrograms = merged.slice(-30)
          return mergedPrograms
        })
        // 只在向下翻页时根据API meta.has_next设置 hasMoreBottom
        if (resp.meta && typeof resp.meta.has_next !== 'undefined') {
          setHasMoreBottom(!!resp.meta.has_next)
        }
        // 向下翻页后允许再次向上翻页
        if (newPrograms.length > 0) setHasMoreTop(true)
      }
    } finally {
      requestInProgress.current = false;
      if (direction === "up") setLoadingTop(false);
      if (direction === "down") setLoadingBottom(false);
      setLocalInitialLoading(false);
      console.log('[fetchData] 请求结束', { direction });
    }
  }

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

  const getExtName = (ext?: number) => {
    switch (ext) {
      case 1: return "Python"
      case 2: return "JavaScript"
      case 3: return "TypeScript"
      case 4: return "Go"
      case 5: return "Java"
      default: return "未知"
    }
  }

  const getExtColor = (ext?: number) => {
    switch (ext) {
      case 1: return "bg-green-100 text-green-800"
      case 2: return "bg-yellow-100 text-yellow-800"
      case 3: return "bg-blue-100 text-blue-800"
      case 4: return "bg-cyan-100 text-cyan-800"
      case 5: return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  // 删除后刷新当前缓存
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDeleteProgram(id)
      setPrograms(prev => prev.filter(p => p.id !== id))
      toast("程序已成功删除")
    } catch (error) {
      toast("删除程序时出现错误")
    } finally {
      setDeletingId(null)
    }

  }

  if (localInitialLoading) {
    return <div className="text-center py-4">加载中...</div>
  }

  return (
    <div className="flex flex-col gap-4 h-[90vh]">
      {/* 童趣化的搜索排序控件区域 */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
        {/* 用户筛选和排序 */}
        {showUserFilter && userOptions.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">👤 筛选用户：</span>
              <Select value={selectedUser} onValueChange={(value) => {
                setSelectedUser(value)
                setSearchKeyword(""); // 选择后清空搜索
              }}>
                <SelectTrigger className="w-40 rounded-xl border-2 border-purple-200 focus:border-purple-400">
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
        
        {/* 程序名称搜索栏 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🔍 搜索程序：</span>
          <input
            className="w-48 h-10 px-4 border-2 border-purple-200 rounded-2xl bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-300"
            placeholder="输入程序名称..."
            value={programKeyword}
            onChange={e => setProgramKeyword(e.target.value)}
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
            setPrograms([])
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
        onScroll={programKeyword ? undefined : handleScroll}
      >
        {programKeyword.length >= 1 && searchingProgram && (
          <div className="text-center text-xs text-muted-foreground py-2">搜索中...</div>
        )}
        {programKeyword.length >= 1 && !searchingProgram && programs.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">无匹配程序</div>
        )}
        {loadingTop && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreTop && <div className="text-center text-xs text-muted-foreground py-2">已到顶部</div>}
        <div className="space-y-3">
          {programs.length > 0 ? (
            programs.map((program, idx) => {
              const creator = userOptions.find(user => user.id === program.user_id)?.nickname || "未知";
              return (
                <div key={program.id || Math.random()} className="bg-white rounded-xl border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 p-6">
                  <div className="flex items-center justify-between">
                    {/* 左侧：程序信息 */}
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      {/* 程序图标 */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                          <IconCode className="h-6 w-6 text-purple-500" />
                        </div>
                      </div>
                      
                      {/* 程序详情 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            <a 
                              href={`/www/user/programs/open/${program.id}`}
                              className="hover:text-purple-600 transition-colors"
                            >
                              {program.name || "未命名程序"}
                            </a>
                          </h3>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getExtColor(program.ext)}`}>
                            {getExtName(program.ext)}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            ID: {program.id}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          {showUserFilter && userOptions.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-green-500">👤</span>
                              <span className="font-medium">创建者：</span>
                              <span>{creator}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-purple-500">⏰</span>
                            <span className="font-medium">创建：</span>
                            <span>{formatDate(program.created_at || program.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-blue-500">📝</span>
                            <span className="font-medium">更新：</span>
                            <span>{formatDate(program.updated_at || program.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        title="编辑"
                        asChild
                        className="h-9 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 hover:scale-105 hover:shadow-md transition-all duration-200 font-medium text-sm group"
                      >
                        <a href={`/www/user/programs/open/${program.id}`}>
                          <IconEdit className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:rotate-12" />
                          编辑
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="查看历史"
                        asChild
                        className="h-9 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 hover:scale-105 hover:shadow-md transition-all duration-200 font-medium text-sm group"
                      >
                        <a href={`/www/user/programs/${program.id}/histories`}>
                          <IconHistory className="h-4 w-4 mr-1 transition-transform duration-200 group-hover:rotate-12" />
                          历史
                        </a>
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            title="删除"
                            asChild
                            className="h-9 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 font-medium text-sm"
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
                              确认删除程序
                            </DialogTitle>
                            <DialogDescription className="text-gray-700 text-lg mt-4 bg-white/70 p-4 rounded-2xl border border-red-100">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">🤔</span>
                                <div>
                                  您确定要删除程序 <span className="font-semibold text-red-800">"{program.name}"</span> 吗？
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
                              onClick={() => handleDelete(program.id)}
                              disabled={deletingId === program.id}
                              className="flex-1 h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-2xl border-2 border-red-400 text-white font-bold text-lg shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              <span className="mr-2">💥</span>
                              {deletingId === program.id ? "删除中..." : "删除程序"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center text-muted-foreground py-12">没有找到程序</div>
          )}
        </div>
        {loadingBottom && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreBottom && <div className="text-center text-xs text-muted-foreground py-2">已到结尾</div>}
      </div>
    </div>
  )
}
