import * as React from "react"
import { Link } from "react-router"
import { IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconHistory, IconRefresh, IconShare } from "@tabler/icons-react"

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
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Checkbox } from "~/components/ui/checkbox"
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
  showUserFilter?: boolean
  projectsApiUrl: string
}

// 缓存相关常量
const CACHE_KEY = 'projectTableCacheV1';
const CACHE_EXPIRE = 60 * 60 * 1000; // 1小时

export function ProjectTable({ 
  onDeleteProject,
  showUserFilter = false,
  projectsApiUrl,
}: ProjectTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [sharingId, setSharingId] = React.useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false)
  const [shareResultDialogOpen, setShareResultDialogOpen] = React.useState(false)
  const [shareUrl, setShareUrl] = React.useState("")
  const [currentShareProject, setCurrentShareProject] = React.useState<Project | null>(null)
  const [isReactivating, setIsReactivating] = React.useState(false)
  const [shareForm, setShareForm] = React.useState({
    title: "",
    description: "",
    maxViews: "",
    allowDownload: false,
    allowRemix: false,
  })
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

  // 打开分享对话框
  const handleShareClick = (project: Project) => {
    console.log("点击分享，项目:", project)
    setCurrentShareProject(project)
    
    // 先检查是否已存在分享
    checkExistingShare(project)
  }

  // 检查项目是否已存在分享
  const checkExistingShare = async (project: Project) => {
    try {
      setSharingId(project.id)
      
      const res = await fetchWithAuth(`${HOST_URL}/api/shares/check?project_id=${project.id}`)
      const result = await res.json()
      
      console.log("检查分享API响应:", result)
      
      if (res.ok && result.data) {
        if (result.data.exists) {
          // 检查分享是否活跃
          if (result.data.is_active) {
            // 分享存在且活跃，直接显示分享链接
            console.log("项目已存在活跃分享，直接显示链接")
            setShareUrl(result.data.share_url)
            setShareResultDialogOpen(true)
            setSharingId(null)
            setIsReactivating(false)
          } else {
            // 分享存在但未激活，显示重新激活对话框
            console.log("项目分享存在但未激活，显示重新激活对话框")
            const newShareForm = {
              title: project.name || "",
              description: "",
              maxViews: "",
              allowDownload: false,
              allowRemix: true,
            }
            console.log("设置分享表单:", newShareForm)
            setShareForm(newShareForm)
            setSharingId(null) // 清除加载状态，允许用户点击重新激活按钮
            setIsReactivating(true) // 标记为重新激活模式
            setShareDialogOpen(true)
          }
        } else {
          // 不存在分享，显示创建分享对话框
          console.log("项目未分享，显示创建对话框")
          const newShareForm = {
            title: project.name || "",
            description: "",
            maxViews: "",
            allowDownload: false,
            allowRemix: true,
          }
          console.log("设置分享表单:", newShareForm)
          setShareForm(newShareForm)
          setSharingId(null) // 清除加载状态，允许用户点击创建按钮
          setIsReactivating(false) // 标记为创建模式
          setShareDialogOpen(true)
        }
      } else {
        console.error("检查分享失败:", result)
        toast("检查分享状态失败")
        setSharingId(null)
      }
    } catch (error) {
      console.error("检查分享时出错：", error)
      toast("检查分享状态时出现网络错误")
      setSharingId(null)
    }
  }

  // 复制分享链接
  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast("分享链接已复制到剪贴板")
    } catch (error) {
      toast("复制失败，请手动复制链接")
    }
  }

  // 创建分享
  const handleCreateShare = async () => {
    if (!currentShareProject) {
      console.error("没有选择项目")
      return
    }
    
    console.log("开始创建分享，项目:", currentShareProject)
    console.log("分享表单数据:", shareForm)
    
    setSharingId(currentShareProject.id)
    try {
      const shareData = {
        project_id: parseInt(currentShareProject.id),
        project_type: 1, // Scratch项目类型
        title: shareForm.title || currentShareProject.name,
        description: shareForm.description,
        max_views: shareForm.maxViews ? parseInt(shareForm.maxViews) : 0,
        allow_download: shareForm.allowDownload,
        allow_remix: shareForm.allowRemix,
      }

      console.log("发送到API的数据:", shareData)

      const res = await fetchWithAuth(`${HOST_URL}/api/shares`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shareData),
      })

      const result = await res.json()
      console.log("API响应:", result)
      
      // 检查是否成功：HTTP状态OK且有data字段
      if (res.ok && result.data && result.data.share_token) {
        const shareToken = result.data.share_token
        const newShareUrl = `${window.location.origin}/shares/${shareToken}`
        
        console.log("分享创建成功，URL:", newShareUrl)
        
        setShareUrl(newShareUrl)
        setShareDialogOpen(false)
        setShareResultDialogOpen(true)
        
        toast("分享链接已创建成功")
      } else {
        console.error("分享创建失败:", result)
        // 显示具体的错误信息
        const errorMessage = result.message || result.error || "未知错误"
        console.log("显示错误toast:", errorMessage)
        toast(`创建分享失败：${errorMessage}`)
      }
    } catch (error) {
      console.error("创建分享时出错：", error)
      toast("创建分享时出现网络错误")
    } finally {
      setSharingId(null)
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
                saveCache("0")
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
        
        {/* 项目名称搜索栏 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🔍 搜索项目：</span>
          <input
            className="w-48 h-10 px-4 border-2 border-purple-200 rounded-2xl bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 transition-all duration-300"
            placeholder="输入项目名称..."
            value={projectKeyword}
            onChange={e => setProjectKeyword(e.target.value)}
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
            setProjects([])
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
                  <CardFooter className="flex flex-col gap-1 px-1 py-1">
                    {/* 第一行：编辑和分享 */}
                    <div className="flex items-center justify-center gap-0 w-full">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="编辑"
                        asChild
                        className="py-0 min-h-0 h-auto px-2 flex-1"
                      >
                        <a href={`${HOST_URL}/projects/scratch/open/${project.id}`}>
                          <IconEdit className="h-4 w-4 mr-1" />
                          编辑
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="分享"
                        onClick={() => handleShareClick(project)}
                        disabled={sharingId === project.id}
                        className="py-0 min-h-0 h-auto px-2 flex-1"
                      >
                        <IconShare className="h-4 w-4 mr-1" />
                        {sharingId === project.id ? "分享中..." : "分享"}
                      </Button>
                    </div>
                    {/* 第二行：删除和历史 */}
                    <div className="flex items-center justify-center gap-0 w-full">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="删除"
                            asChild
                            className="py-0 min-h-0 h-auto px-2 flex-1"
                          >
                            <a href='#'>
                              <IconTrash className="h-4 w-4 mr-1" />
                              删除
                            </a>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl border-4 border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
                          <DialogHeader className="text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                              <IconTrash className="w-8 h-8 text-red-500" />
                            </div>
                            <DialogTitle className="text-2xl font-bold text-gray-800">⚠️ 确认删除</DialogTitle>
                            <DialogDescription className="text-lg text-gray-600 mt-2">
                              您确定要删除项目 "<span className="font-medium text-purple-600">{project.name}</span>" 吗？
                              <br />
                              <span className="text-red-500 font-medium">此操作无法撤销哦！</span>
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="flex gap-3 pt-6">
                            <DialogClose asChild>
                              <Button 
                                variant="outline" 
                                className="flex-1 h-12 rounded-2xl border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium"
                              >
                                💭 再想想
                              </Button>
                            </DialogClose>
                            <Button 
                              variant="destructive" 
                              onClick={() => handleDelete(project.id)}
                              disabled={deletingId === project.id}
                              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium border-0"
                            >
                              {deletingId === project.id ? "🗑️ 删除中..." : "🗑️ 确认删除"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="历史"
                        asChild
                        className="py-0 min-h-0 h-auto px-2 flex-1"
                      >
                        <a href={`/www/scratch/project/${project.id}/histories`}>
                          <IconHistory className="h-4 w-4 mr-1" />
                          历史
                        </a>
                      </Button>
                    </div>
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

      {/* 分享对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => {
        console.log("分享对话框状态变更:", open)
        setShareDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-4 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <IconShare className="w-8 h-8 text-blue-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-800">
              {isReactivating ? "🔄 重新激活分享" : "✨ 分享项目"}
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600 mt-2">
              {isReactivating ? "该项目的分享已停用，您可以重新激活分享" : "设置分享参数并生成分享链接，让朋友们看到你的作品！"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label htmlFor="share-title" className="text-base font-medium text-gray-700 flex items-center gap-2">
                📝 分享标题
              </Label>
              <Input
                id="share-title"
                value={shareForm.title}
                readOnly
                placeholder="输入分享标题"
                className="h-12 rounded-2xl border-2 border-purple-200 bg-purple-50 text-gray-600"
              />
              <div className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                💡 标题将使用项目原名称
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="share-description" className="text-base font-medium text-gray-700 flex items-center gap-2">
                💬 分享描述
              </Label>
              <Textarea
                id="share-description"
                value={shareForm.description}
                onChange={(e) => setShareForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="告诉大家这个项目有什么特别之处吧！（可选）"
                rows={4}
                className="rounded-2xl border-2 border-purple-200 focus:border-purple-400 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-6">
            <DialogClose asChild>
              <Button 
                variant="outline"
                className="flex-1 h-12 rounded-2xl border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium"
              >
                ❌ 取消
              </Button>
            </DialogClose>
            <Button 
              onClick={handleCreateShare}
              disabled={!currentShareProject || sharingId === currentShareProject?.id}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium border-0"
            >
              {sharingId === currentShareProject?.id 
                ? (isReactivating ? "🔄 激活中..." : "✨ 创建中...") 
                : (isReactivating ? "🔄 重新激活分享" : "🚀 创建分享链接")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享结果对话框 */}
      <Dialog open={shareResultDialogOpen} onOpenChange={(open) => {
        console.log("分享结果对话框状态变更:", open)
        setShareResultDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-4 border-green-200 bg-gradient-to-br from-green-50 to-blue-50">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <DialogTitle className="text-2xl font-bold text-gray-800">🎊 分享链接已创建</DialogTitle>
            <DialogDescription className="text-lg text-gray-600 mt-2">
              太棒了！你的项目分享链接已成功创建
              <br />
              快复制链接分享给朋友们吧！
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label htmlFor="share-url" className="text-base font-medium text-gray-700 flex items-center gap-2">
                🔗 分享链接
              </Label>
              <div className="flex gap-3">
                <Input
                  id="share-url"
                  value={shareUrl}
                  readOnly
                  className="flex-1 h-12 rounded-2xl border-2 border-green-200 bg-green-50 text-gray-700 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyShareUrl}
                  className="h-12 px-4 rounded-2xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 font-medium"
                >
                  📋 复制
                </Button>
              </div>
              <div className="text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-xl p-3">
                🌟 分享给朋友，让他们看到你的精彩作品！
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-3 pt-6">
            <Button 
              variant="outline"
              onClick={() => window.open(shareUrl, '_blank')}
              className="flex-1 h-12 rounded-2xl border-2 border-purple-300 hover:border-purple-400 text-purple-700 font-medium"
            >
              👀 预览分享
            </Button>
            <DialogClose asChild>
              <Button className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium border-0">
                ✅ 完成
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}