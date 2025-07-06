import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconBook, IconLoader, IconRefresh } from "@tabler/icons-react"

import { AdminLayout } from "~/components/admin-layout"
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
import { Badge } from "~/components/ui/badge"
import { Checkbox } from "~/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { toast } from "sonner"

import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

// 课件类型定义
interface Lesson {
  id: number
  title: string
  content: string
  sort_order: number
  document_name: string
  document_path: string
  flow_chart_id: number
  project_type: string
  project_id_1: number
  project_id_2: number
  project_id_3: number
  video_1: string
  video_2: string
  video_3: string
  duration: number
  difficulty: string
  description: string
  created_at: number
  updated_at: number
  courses?: {
    id: number
    title: string
    description: string
  }[]
}

// 课件表格行组件
function LessonRow({ 
  lesson, 
  isSelected, 
  onSelect, 
  onDelete, 
  deletingId
}: {
  lesson: Lesson
  isSelected: boolean
  onSelect: (id: number, checked: boolean) => void
  onDelete: (id: string, updatedAt: string) => void
  deletingId: string | null
}) {
  // 格式化难度
  const formatDifficulty = (difficulty: string) => {
    const difficultyMap: { [key: string]: string } = {
      'beginner': '初级',
      'intermediate': '中级', 
      'advanced': '高级'
    }
    return difficultyMap[difficulty] || difficulty
  }

  // 格式化时长
  const formatDuration = (duration: number) => {
    if (!duration || duration <= 0) return "未设置"
    
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    
    if (hours > 0) {
      return `${hours}小时${minutes > 0 ? `${minutes}分钟` : ''}`
    } else {
      return `${minutes}分钟`
    }
  }

  // 格式化日期
  const formatDate = (timestamp?: string | number) => {
    if (!timestamp) return "未知日期"
    
    try {
      let date: Date
      if (typeof timestamp === 'number') {
        date = new Date(timestamp * 1000)
      } else if (typeof timestamp === 'string') {
        const numTimestamp = parseInt(timestamp)
        if (!isNaN(numTimestamp)) {
          date = new Date(numTimestamp * 1000)
        } else {
          date = new Date(timestamp)
        }
      } else {
        return "未知日期"
      }
      
      if (isNaN(date.getTime())) {
        return "未知日期"
      }
      
      return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      })
    } catch (error) {
      return "日期格式错误"
    }
  }

  return (
    <TableRow
      className={isSelected ? "bg-blue-50 border-blue-200" : ""}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(lesson.id, checked as boolean)}
        />
      </TableCell>
      <TableCell className="font-medium">{lesson.id}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{lesson.title}</span>
          {lesson.description && (
            <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
              {lesson.description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {formatDifficulty(lesson.difficulty)}
        </Badge>
      </TableCell>
      <TableCell>{formatDuration(lesson.duration)}</TableCell>
      <TableCell>{formatDate(lesson.created_at)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/www/admin/edit_lesson/${lesson.id}`}>
              <IconEdit className="h-4 w-4" />
            </Link>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <IconTrash className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除</DialogTitle>
                <DialogDescription>
                  确定要删除课件 "{lesson.title}" 吗？此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(lesson.id.toString(), lesson.updated_at.toString())}
                    disabled={deletingId === lesson.id.toString()}
                  >
                    {deletingId === lesson.id.toString() ? "删除中..." : "确认删除"}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TableCell>
    </TableRow>
  )
}

// 简化的普通表格组件
function LessonTable({
  lessons,
  selectedLessons,
  onLessonSelect,
  onDeleteLesson,
  deletingId,
  loadingTop,
  loadingBottom,
  hasMoreTop,
  hasMoreBottom,
  onScroll,
  total
}: {
  lessons: Lesson[]
  selectedLessons: number[]
  onLessonSelect: (id: number, checked: boolean) => void
  onDeleteLesson: (id: string, updatedAt: string) => void
  deletingId: string | null
  loadingTop: boolean
  loadingBottom: boolean
  hasMoreTop: boolean
  hasMoreBottom: boolean
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  total: number
}) {
  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      lessons.forEach(lesson => onLessonSelect(lesson.id, true))
    } else {
      selectedLessons.forEach(id => onLessonSelect(id, false))
    }
  }

  return (
    <div className="rounded-md border flex flex-col max-h-[70vh]">
      <div 
        className="flex-1 overflow-auto px-1"
        onScroll={onScroll}
      >
        {/* 向上加载指示器 */}
        {loadingTop && (
          <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
            <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
            <span className="text-blue-700 text-sm">正在加载历史数据...</span>
          </div>
        )}
        
        {/* 顶部提示 */}
        {!loadingTop && hasMoreTop && lessons.length > 0 && (
          <div className="flex items-center justify-center py-3 bg-green-50 border border-green-200 rounded-lg mx-4 my-2">
            <span className="text-green-700 text-sm">
              📚 还有更多历史课件数据，向上滚动或使用按钮加载
            </span>
          </div>
        )}

        <Table>
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLessons.length === lessons.length && lessons.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>课件名称</TableHead>
              <TableHead>难度</TableHead>
              <TableHead>时长</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="empty-state">
                    <IconBook className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">暂无课件数据</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isSelected={selectedLessons.includes(lesson.id)}
                  onSelect={onLessonSelect}
                  onDelete={onDeleteLesson}
                  deletingId={deletingId}
                />
              ))
            )}
          </TableBody>
        </Table>

        {/* 向下加载指示器 */}
        {loadingBottom && (
          <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
            <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
            <span className="text-blue-700 text-sm">正在加载更多数据...</span>
          </div>
        )}

        {/* 数据状态提示 */}
        {lessons.length > 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-gray-500">
            <span className="text-sm">
              当前显示 {lessons.length} 条数据 / 共 {total} 条
            </span>
            <span className="text-xs mt-1">
              ID范围: {lessons[0]?.id} ~ {lessons[lessons.length-1]?.id}
              {!hasMoreTop && !hasMoreBottom && " (已加载全部)"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// 获取课件列表API
async function getLessons(courseId = "", beginID = "0", pageSize = 20, forward = true, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    params.append('beginID', beginID.toString())
    if (courseId) {
      params.append('courseId', courseId)
    }
    
    const url = `${HOST_URL}/api/admin/lessons?${params.toString()}`
    const response = await fetchWithAuth(url)
    
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error("获取课件列表失败:", error)
    throw error
  }
}

// 删除课件
async function deleteLesson(id: string, updatedAt: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        updated_at: updatedAt
      })
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("删除课件失败:", error)
    throw error
  }
}

export default function ListLessonsPage() {
  // 基础状态
  const [lessons, setLessons] = React.useState<Lesson[]>([])
  const [total, setTotal] = React.useState(0)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  
  // 加载状态
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  
  // 排序控制
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  
  // 防并发和节流控制
  const [lastRequestTime, setLastRequestTime] = React.useState(0)
  const requestInProgress = React.useRef(false)
  const REQUEST_INTERVAL = 300

  // 保存当前课件数据的引用，避免循环依赖
  const lessonsRef = React.useRef<Lesson[]>([])
  
  // 同步 lessons 状态到 ref
  React.useEffect(() => {
    lessonsRef.current = lessons
  }, [lessons])

  // fetchData 用 useCallback 包裹，依赖 sortOrder，防止闭包陷阱
  const fetchData = React.useCallback(async ({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) => {
    let ignore = false;
    const pageSize = 20;
    let beginID = "0";
    let forward = true;
    const asc = sortOrder === "asc";
    const currentLessons = lessonsRef.current;

    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && currentLessons.length > 0) {
      if (direction === "up") {
        beginID = currentLessons[0].id.toString();
        forward = false;
      } else {
        beginID = currentLessons[currentLessons.length - 1].id.toString();
        forward = true;
      }
    }

    if (direction === "up") setLoadingTop(true);
    if (direction === "down") setLoadingBottom(true);

    try {
      const response = await getLessons("", beginID, pageSize, forward, asc);
      if (ignore) return;
      const newLessons = response.data || [];
      const meta = response.meta || {};

      if (reset) {
        setLessons(newLessons);
        setTotal(meta.total || 0);
        setHasMoreTop(false);
        setHasMoreBottom(meta.has_next || false);
        setInitialLoading(false);
        return;
      }

      if (direction === "up") {
        if (newLessons.length === 0) {
          setHasMoreTop(false);
        } else {
          setLessons(prev => {
            const prevIds = new Set(prev.map(lesson => lesson.id));
            const uniqueNewLessons = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id));
            const merged = [...uniqueNewLessons, ...prev];
            const trimmed = merged.slice(0, 50);
            return trimmed;
          });
          const prevIds = new Set(currentLessons.map(lesson => lesson.id));
          const uniqueCount = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id)).length;
          if (uniqueCount === 0) {
            setHasMoreTop(false);
          } else {
            setHasMoreBottom(true);
          }
        }
      } else {
        if (newLessons.length === 0) {
          setHasMoreBottom(false);
        } else {
          setLessons(prev => {
            const prevIds = new Set(prev.map(lesson => lesson.id));
            const uniqueNewLessons = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id));
            const merged = [...prev, ...uniqueNewLessons];
            const trimmed = merged.slice(-50);
            return trimmed;
          });
          const prevIds = new Set(currentLessons.map(lesson => lesson.id));
          const uniqueCount = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id)).length;
          const newHasMoreBottom = (meta.has_next || false) && uniqueCount > 0;
          setHasMoreBottom(newHasMoreBottom);
          if (uniqueCount > 0) {
            setHasMoreTop(true);
          }
        }
      }
    } catch (error) {
      if (!ignore) {
        console.error("API请求失败:", error);
        toast.error("加载数据失败");
      }
    } finally {
      if (!ignore) {
        if (direction === "up") setLoadingTop(false);
        if (direction === "down") setLoadingBottom(false);
      }
    }
    return () => { ignore = true; };
  }, [sortOrder]);

  // lessonsRef 用 useCallback 依赖 lessons 替代
  React.useEffect(() => {
    lessonsRef.current = lessons;
  }, [lessons]);

  // 初始化数据加载
  React.useEffect(() => {
    setInitialLoading(true);
    fetchData({ direction: "down", reset: true, customBeginID: "0" });
  }, [fetchData]);

  // 监听排序变化
  React.useEffect(() => {
    if (!initialLoading) {
      setSelectedLessons([]);
      setHasMoreTop(false);
      setHasMoreBottom(true);
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
    }
  }, [sortOrder, initialLoading, fetchData]);

  // 顶部位置自动检测
  React.useEffect(() => {
    const checkTopPosition = () => {
      const container = document.querySelector('.overflow-auto') as HTMLDivElement;
      if (!container) return;
      if (container.scrollTop === 0 && hasMoreTop && !loadingTop) {
        fetchData({ direction: "up" });
      }
    };
    const timer = setTimeout(checkTopPosition, 500);
    return () => clearTimeout(timer);
  }, [lessons.length, hasMoreTop, loadingTop, fetchData]);

  // 滚动处理
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop) {
      fetchData({ direction: "up" });
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom) {
      fetchData({ direction: "down" });
    }
  }, [hasMoreTop, hasMoreBottom, loadingTop, loadingBottom, fetchData]);

  // 刷新数据
  const refreshData = React.useCallback(async () => {
    setSelectedLessons([])
    setHasMoreTop(false)
    setHasMoreBottom(true)
    
    // 直接调用API而不是通过fetchData，避免循环依赖
    try {
      const pageSize = 20
      const asc = sortOrder === "asc"
      const response = await getLessons("", "0", pageSize, true, asc)
      const newLessons = response.data || []
      const meta = response.meta || {}

      setLessons(newLessons)
      setTotal(meta.total || 0)
      setHasMoreTop(false)
      setHasMoreBottom(meta.has_next || false)
      setInitialLoading(false)
    } catch (error) {
      console.error("刷新数据失败:", error)
      toast.error("刷新数据失败")
    }
  }, [sortOrder])

  // 课件选择
  const handleLessonSelect = React.useCallback((lessonId: number, checked: boolean) => {
    if (checked) {
      setSelectedLessons(prev => [...prev, lessonId])
    } else {
      setSelectedLessons(prev => prev.filter(id => id !== lessonId))
    }
  }, [])

  // 删除课件
  const handleDeleteLesson = React.useCallback(async (id: string, updatedAt: string) => {
    setDeletingId(id)
    try {
      await deleteLesson(id, updatedAt)
      toast.success("课件删除成功")
      
      // 从列表中移除已删除的课件
      setLessons(prev => prev.filter(lesson => lesson.id.toString() !== id))
      setSelectedLessons(prev => prev.filter(lessonId => lessonId.toString() !== id))
      setTotal(prev => prev - 1)
    } catch (error) {
      console.error("删除课件失败:", error)
      toast.error("删除课件失败")
    } finally {
      setDeletingId(null)
    }
  }, [])

  // 新建课件点击处理
  const handleNewLessonClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 1000)
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBook className="h-6 w-6" />
            <h1 className="text-2xl font-bold">课件管理</h1>
            <span className="text-sm text-gray-500">
              (共{total}个, 显示{lessons.length}个)
            </span>
            {/* 加载状态指示器 */}
            {(initialLoading || loadingTop || loadingBottom) && (
              <div className="flex items-center gap-1 ml-4 px-2 py-1 bg-blue-100 rounded-full">
                <IconLoader className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-xs text-blue-600">
                  {initialLoading ? "初始化" : loadingTop ? "加载历史" : "加载更多"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 排序控制 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">📅 排序：</span>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">🆕 最新优先</SelectItem>
                  <SelectItem value="asc">⏰ 最旧优先</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 刷新按钮 */}
            <Button variant="outline" size="sm" onClick={refreshData}>
              <IconRefresh className="h-4 w-4 mr-1" />
              刷新
            </Button>
            
            {/* 新建课件 */}
            <Link 
              to="/www/admin/create_lesson" 
              onClick={handleNewLessonClick}
              className={isButtonCooling ? 'pointer-events-none' : ''}
            >
              <Button disabled={isButtonCooling}>
                <IconPlus className="mr-2 h-4 w-4" />
                新建课件
              </Button>
            </Link>
          </div>
        </div>

        {/* 选择工具栏 */}
        {selectedLessons.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border rounded-md">
            <span className="text-sm font-medium">
              已选择 {selectedLessons.length} 个课件
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedLessons([])}>
                取消选择
              </Button>
            </div>
          </div>
        )}

        {/* 主内容区域 */}
        {initialLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="flex items-center space-x-2">
              <IconLoader className="h-6 w-6 animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        ) : (
          <LessonTable
            lessons={lessons}
            selectedLessons={selectedLessons}
            onLessonSelect={handleLessonSelect}
            onDeleteLesson={handleDeleteLesson}
            deletingId={deletingId}
            loadingTop={loadingTop}
            loadingBottom={loadingBottom}
            hasMoreTop={hasMoreTop}
            hasMoreBottom={hasMoreBottom}
            onScroll={handleScroll}
            total={total}
          />
        )}
      </div>
    </AdminLayout>
  )
}

/*
 * 🚀 全新的滚动翻页系统
 * 
 * 核心特性：
 * ✅ 防并发请求 - requestInProgress.current 控制
 * ✅ 时间间隔控制 - 800ms 请求间隔
 * ✅ beginID + meta 驱动翻页
 * ✅ forward=true 向下, forward=false 向上
 * ✅ ASC/DESC 排序选择
 * ✅ 滑动窗口缓存30条数据
 * 
 * 翻页逻辑：
 * - 向上: 使用第一条数据ID, forward=false
 * - 向下: 使用最后一条数据ID, forward=true
 * - 基于 API meta.has_next 判断是否还有更多数据
 * 
 * 防护机制：
 * - requestInProgress 防止并发
 * - lastRequestTime 控制请求间隔
 * - 滚动边界检测 (距离边缘100px触发)
 */ 