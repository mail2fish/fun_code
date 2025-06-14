import * as React from "react"
import { Link } from "react-router"
import { IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconHistory, IconRefresh } from "@tabler/icons-react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { toast } from  "sonner" 

import { HOST_URL } from "~/config";
import { Card, CardContent, CardFooter } from "~/components/ui/card"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { fetchWithAuth } from "~/utils/api"

export interface Project {
  id: string
  name: string
  user_id: string
  created_at?: string
  createdAt?: string
}

export interface User {
  id: string
  nickname: string
}

export interface ProjectsData{
  projects: Project[]
  users: User[]
  total: number
  showForward:boolean
  showBackward:boolean 
  pageSize: number
  currentPage: number
}


interface ProjectTableProps {
  projectsData?: ProjectsData
  isLoading?: boolean
  onDeleteProject: (id: string) => Promise<void>
  onPageChange?: (nextCursor: string,forward:boolean,asc:boolean) => void
  showUserFilter?: boolean
  projectsApiUrl: string
}

// 缓存相关常量
const CACHE_KEY = 'projectTableCacheV1';
const CACHE_EXPIRE = 60 * 60 * 1000; // 1小时

export function ProjectTable({ 
  onDeleteProject,
  onPageChange,
  showUserFilter = false,
  projectsApiUrl,
}: ProjectTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [userOptions, setUserOptions] = React.useState<User[]>([])
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<User[]>([]);
  const [projectKeyword, setProjectKeyword] = React.useState("");
  const [searchingProject, setSearchingProject] = React.useState(false);
  // 先尝试从localStorage读取缓存
  const getInitialCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_EXPIRE) return null;
      if (showUserFilter) {
        // 缓存 beginID 会产生一些奇怪的问题，暂时先禁用
        data.beginID = 0;
        return data;
      } else {
        return {
        // 缓存 beginID 会产生一些奇怪的问题，暂时先禁用
          beginID: 0,
          sortOrder: data.sortOrder,
        };
      }
    } catch {
      return null;
    }
  };
  const initialCache = getInitialCache();
  const [selectedUser, setSelectedUser] = React.useState<string>(initialCache?.selectedUser || "__all__")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">(initialCache?.sortOrder || "desc")
  // beginID 只用于缓存和恢复，不作为state

  // 无限滚动相关状态
  const [projects, setProjects] = React.useState<Project[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // 写入缓存
  const saveCache = React.useCallback((beginID: string) => {
    if (typeof window === 'undefined') return;

    let bID=parseInt(beginID)

    if (sortOrder === "asc" && bID > 0) {
      bID = bID - 1
    } else if (sortOrder === "desc" && bID > 0) {
      bID = bID + 1
    }
    beginID = bID.toString()

    const data = {
      beginID,
      sortOrder,
      selectedUser,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  }, [sortOrder, selectedUser]);

  // 获取用户列表
  React.useEffect(() => {
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
  }, [])

  // 搜索用户（带防抖）
  React.useEffect(() => {
    if (!searchKeyword) {
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
  }, [searchKeyword]);

  // 项目名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!projectKeyword || projectKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setProjects([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      fetchData({ direction: "down", reset: true, customBeginID: initialCache?.beginID || "0" });
      return;
    }
    setSearchingProject(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append("keyword", projectKeyword);
        if (selectedUser && selectedUser !== "__all__") params.append("userId", selectedUser);
        const res = await fetchWithAuth(`${HOST_URL}/api/scratch/projects/search?${params.toString()}`);
        const data = await res.json();
        let newProjects: Project[] = [];
        if (Array.isArray(data.data)) {
          newProjects = data.data;
        } else if (Array.isArray(data.data?.projects)) {
          newProjects = data.data.projects;
        }
        setProjects(newProjects);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (e) {
        setProjects([]);
      } finally {
        setSearchingProject(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [projectKeyword, selectedUser]);

  // 监听筛选用户和排序变化，重置缓存并加载初始数据
  React.useEffect(() => {
    setProjects([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    // beginID 设为 initialCache.beginID 或 0
    saveCache(initialCache?.beginID || "0");
    fetchData({ direction: "down", reset: true, customBeginID: initialCache?.beginID || "0" })
    // eslint-disable-next-line
  }, [selectedUser, sortOrder])

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
    let userId = selectedUser === "__all__" ? undefined : selectedUser
    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && projects.length > 0) {
      if (direction === "up") {
        beginID = projects[0].id
        forward = false
      } else {
        beginID = projects[projects.length - 1].id
        forward = true
      }
    }
    if (direction === "up") setLoadingTop(true)
    if (direction === "down") setLoadingBottom(true)
    try {
      const params = new URLSearchParams()
      params.append("pageSize", String(pageSize))
      params.append("forward", String(forward))
      params.append("asc", String(asc))
      if (beginID !== "0") params.append("beginID", beginID)
      if (userId) params.append("userId", userId)
      const res = await fetchWithAuth(`${projectsApiUrl}?${params.toString()}`)
      const resp = await res.json()

      // 兼容不同接口返回结构
      let newProjects: Project[] = [];
      if (Array.isArray(resp.data)) {
        newProjects = resp.data;
      } else if (Array.isArray(resp.data.projects)) {
        newProjects = resp.data.projects;
      } else {
        newProjects = [];
      }
      if (reset) {
        setProjects(newProjects)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        // 缓存第一页的beginID
        if (newProjects.length > 0) {
          saveCache(newProjects[0].id)
        } else {
          saveCache("0")
        }
        return
      }
      if (direction === "up") {
        if (newProjects.length === 0) setHasMoreTop(false)
        setProjects(prev => {
          const merged = [...newProjects, ...prev]
          // 缓存最新的beginID
          let mergedProjects = merged.slice(0, 30)
          if (mergedProjects.length > 0) saveCache(mergedProjects[0].id)
          return mergedProjects
        })
      } else {
        if (newProjects.length === 0) setHasMoreBottom(false)
        setProjects(prev => {
          const merged = [...prev, ...newProjects]
          // 缓存最新的beginID
          let mergedProjects = merged.slice(-30)
          if (mergedProjects.length > 0) saveCache(mergedProjects[0].id)
          return mergedProjects
        })
      }
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      setLocalInitialLoading(false)
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

  // 删除后刷新当前缓存
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDeleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      toast("项目已成功删除")
    } catch (error) {
      toast("删除项目时出现错误")
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
        {/* 用户筛选和排序 */}
        {showUserFilter && userOptions.length > 0 && (
          <>
            <Select value={selectedUser} onValueChange={(value) => {
              setSelectedUser(value)
              saveCache("0")
              setSearchKeyword(""); // 选择后清空搜索
            }}>
              <SelectTrigger className="w-40">
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
           
          </>
        )}
        {/* 项目名称搜索栏 */}
        <input
          className="w-48 h-8 px-3 border border-input rounded-md bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
          placeholder="搜索项目名称"
          value={projectKeyword}
          onChange={e => setProjectKeyword(e.target.value)}
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
            setProjects([])
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
        onScroll={projectKeyword ? undefined : handleScroll}
      >
        {projectKeyword.length >= 1 && searchingProject && (
          <div className="text-center text-xs text-muted-foreground py-2">搜索中...</div>
        )}
        {projectKeyword.length >= 1 && !searchingProject && projects.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-2">无匹配项目</div>
        )}
        {loadingTop && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreTop && <div className="text-center text-xs text-muted-foreground py-2">已到顶部</div>}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {projects.length > 0 ? (
            projects.map((project, idx) => {
              const creator = userOptions.find(user => user.id === project.user_id)?.nickname || "未知";
              return (
                <Card key={project.id || Math.random()} className="flex flex-col h-full">
                  <div className="w-full h-40 flex items-center justify-center rounded-t-xl bg-gray-50">
                    <a href={`${HOST_URL}/projects/scratch/open/${project.id}`}>
                      <img
                        src={`${HOST_URL}/api/scratch/projects/${project.id}/thumbnail`}
                        className="max-h-32 object-contain"
                        alt="缩略图"
                      />
                    </a>
                  </div>
                  <CardContent className="flex flex-col gap-2 flex-1">
                    <div className="text-xs text-muted-foreground">项目序号：{project.id}</div>
                    <div className="font-medium text-base line-clamp-1">
                      <a href={`${HOST_URL}/projects/scratch/open/${project.id}`}>{project.name || "未命名项目"}</a>
                    </div>
                    {showUserFilter && userOptions.length > 0 && (
                      <div className="text-sm text-muted-foreground">创建者：{creator}</div>
                    )}
                    <div className="text-sm text-muted-foreground">创建时间：{formatDate(project.created_at || project.createdAt)}</div>
                  </CardContent>
                  <CardFooter className="flex items-center gap-0 px-1 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="编辑"
                      asChild
                      className="py-0 min-h-0 h-auto px-1"
                    >
                      <a href={`${HOST_URL}/projects/scratch/open/${project.id}`}>
                        <IconEdit className="h-4 w-4 mr-1" />
                        编辑
                      </a>
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="删除"
                          asChild
                          className="py-0 min-h-0 h-auto px-1"
                        >
                          <a href='#'>
                            <IconTrash className="h-4 w-4 mr-1" />
                            删除
                          </a>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认删除</DialogTitle>
                          <DialogDescription>
                            您确定要删除项目 "{project.name}" 吗？此操作无法撤销。
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDelete(project.id)}
                            disabled={deletingId === project.id}
                          >
                            {deletingId === project.id ? "删除中..." : "删除"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="历史"
                      asChild
                      className="py-0 min-h-0 h-auto px-1"
                    >
                      <a href={`/www/scratch/project/${project.id}/histories`}>
                        <IconHistory className="h-4 w-4 mr-1" />
                        历史
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              )
            })
          ) : (
            <div className="col-span-full text-center text-muted-foreground py-12">没有找到 Scratch 项目</div>
          )}
        </div>
        {loadingBottom && <div className="text-center text-xs text-muted-foreground py-2">加载中...</div>}
        {!hasMoreBottom && <div className="text-center text-xs text-muted-foreground py-2">已到结尾</div>}
      </div>
    </div>
  )
}