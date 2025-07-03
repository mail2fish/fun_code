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
import { toast } from "sonner"

import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

// 课时类型定义
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

// 虚拟化列表项高度
const ITEM_HEIGHT = 80 // 表格行高度比卡片小
const CONTAINER_HEIGHT = 600
const BUFFER_SIZE = 5 // 缓冲区大小

// 课件表格行组件
function LessonRow({ 
  lesson, 
  isSelected, 
  onSelect, 
  onDelete, 
  deletingId,
  style,
  globalIndex
}: {
  lesson: Lesson
  isSelected: boolean
  onSelect: (id: number, checked: boolean) => void
  onDelete: (id: string, updatedAt: string) => void
  deletingId: string | null
  style?: React.CSSProperties
  globalIndex: number
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
      style={style}
      className={`virtual-list-item fade-in ${isSelected ? "bg-blue-50 border-blue-200" : ""}`}
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

// 虚拟化表格组件
function VirtualizedLessonTable({
  lessons,
  selectedLessons,
  onLessonSelect,
  onDeleteLesson,
  deletingId,
  onLoadMore,
  onLoadOlder,
  hasMore,
  isLoading,
  onSelectAll,
  currentPageInfo,
  total
}: {
  lessons: Lesson[]
  selectedLessons: number[]
  onLessonSelect: (id: number, checked: boolean) => void
  onDeleteLesson: (id: string, updatedAt: string) => void
  deletingId: string | null
  onLoadMore: () => void
  onLoadOlder: () => void
  hasMore: boolean
  isLoading: boolean
  onSelectAll: (checked: boolean) => void
  currentPageInfo: { startIndex: number; endIndex: number }
  total: number
}) {
  const [scrollTop, setScrollTop] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [lastScrollTop, setLastScrollTop] = React.useState(0)

  // 计算可见范围
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE)
  const endIndex = Math.min(
    lessons.length,
    Math.ceil((scrollTop + CONTAINER_HEIGHT) / ITEM_HEIGHT) + BUFFER_SIZE
  )

  // 处理滚动
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const currentScrollTop = target.scrollTop
    setScrollTop(currentScrollTop)

    // 检查是否需要加载更多数据
    const { scrollTop, scrollHeight, clientHeight } = target
    
    // 向下滚动到底部时加载更新的数据
    if (scrollHeight - scrollTop - clientHeight < 200 && !isLoading) {
      onLoadMore()
    }
    
    // 向上滚动到顶部时加载更旧的数据
    if (scrollTop < 200 && !isLoading && lessons.length > 0) {
      // 保存当前滚动位置，用于数据加载后恢复位置
      const beforeLoadScrollTop = scrollTop
      const beforeLoadScrollHeight = scrollHeight
      
      // 加载更旧的数据
      onLoadOlder()
      
      // 在下一个渲染周期恢复滚动位置
      setTimeout(() => {
        if (containerRef.current) {
          const newScrollHeight = containerRef.current.scrollHeight
          const heightDiff = newScrollHeight - beforeLoadScrollHeight
          containerRef.current.scrollTo({
            top: beforeLoadScrollTop + heightDiff,
            behavior: 'auto'
          })
        }
      }, 10)
    }
    
    setLastScrollTop(currentScrollTop)
  }, [isLoading, onLoadMore, onLoadOlder, currentPageInfo.startIndex])

  // 可见的课程列表
  const visibleLessons = lessons.slice(startIndex, endIndex)

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-white z-10">
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedLessons.length === lessons.length && lessons.length > 0}
                onCheckedChange={onSelectAll}
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
      </Table>
      
      <div 
        ref={containerRef}
        className="virtual-list-container scrollbar-thin scroll-smooth"
        style={{ height: CONTAINER_HEIGHT, overflow: 'auto' }}
        onScroll={handleScroll}
      >
        <div style={{ height: startIndex * ITEM_HEIGHT }} />
        
        <Table>
          <TableBody>
            {lessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="empty-state fade-in">
                    <IconBook className="h-8 w-8 mx-auto mb-2 empty-state-icon" />
                    <p>暂无课件数据</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleLessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isSelected={selectedLessons.includes(lesson.id)}
                  onSelect={onLessonSelect}
                  onDelete={onDeleteLesson}
                  deletingId={deletingId}
                  style={{ height: ITEM_HEIGHT }}
                  globalIndex={startIndex + index}
                />
              ))
            )}
          </TableBody>
        </Table>

        <div style={{ height: (lessons.length - endIndex) * ITEM_HEIGHT }} />

        {/* 加载更多指示器 */}
        {isLoading && (
          <div className="flex items-center justify-center py-8 fade-in">
            <IconLoader className="h-6 w-6 loading-spinner mr-2" />
            <span>加载中...</span>
          </div>
        )}

        {/* 缓存状态提示 */}
        {lessons.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 fade-in">
            <span>
              当前缓存 {lessons.length} 条数据 / 共 {total} 条
              {lessons.length >= total && " (已缓存全部)"}
            </span>
            <span className="text-xs mt-1">
              向上/向下滚动浏览更多数据，系统每5分钟自动检查更新
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// 获取课件列表
async function getLessons(courseId = "", beginID = "0", pageSize = 20, forward = false, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    if (beginID !== "0") {
      params.append('beginID', beginID.toString())
    }
    if (courseId) {
      params.append('courseId', courseId)
    }
    
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
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
  const [lessons, setLessons] = React.useState<Lesson[]>([])
  const [total, setTotal] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  const [lastCheckTime, setLastCheckTime] = React.useState<number>(Date.now())
  
  // 缓存管理相关状态
  const [currentPageInfo, setCurrentPageInfo] = React.useState({
    startIndex: 0,  // 当前缓存数据在总数据中的起始位置
    endIndex: 0     // 当前缓存数据在总数据中的结束位置
  })
  const MAX_CACHED_ITEMS = 40 // 最多缓存两页数据（每页20条）

  // 初始化加载数据
  const fetchInitialLessons = async () => {
    try {
      setIsInitialLoading(true)
      setError(null)
      const response = await getLessons("", "0", 20, true, false) // 降序获取最新的课程

      const newLessons = response.data || []
      setLessons(newLessons)
      setTotal(response.meta?.total || 0)
      setHasMore(response.meta?.has_next || false)
      
      // 重置缓存页面信息
      setCurrentPageInfo({
        startIndex: 0,
        endIndex: 0
      })
    } catch (error) {
      console.error("初始化加载失败:", error)
      setError("加载课件列表失败")
      setLessons([])
      setTotal(0)
      setHasMore(false)
      setCurrentPageInfo({ startIndex: 0, endIndex: 0 })
    } finally {
      setIsInitialLoading(false)
    }
  }

  // 向下加载更新的数据
  const loadNewerData = async () => {
    if (isLoading) return false

    try {
      setIsLoading(true)
      const lastLesson = lessons[lessons.length - 1]
      const beginID = lastLesson ? lastLesson.id.toString() : "0"
      
      const response = await getLessons("", beginID, 20, true, false)
      
      const newLessons = response.data || []
      
      if (newLessons.length > 0) {
        setLessons(prev => {
          const combinedLessons = [...prev, ...newLessons]
          
          // 实现滑动窗口：如果超过最大缓存数量，移除最旧的数据
          if (combinedLessons.length > MAX_CACHED_ITEMS) {
            const excessCount = combinedLessons.length - MAX_CACHED_ITEMS
            const trimmedLessons = combinedLessons.slice(excessCount)
            return trimmedLessons
          } else {
            return combinedLessons
          }
        })
        
        setHasMore(response.meta?.has_next || false)
        setLastCheckTime(Date.now())
        return true // 有新数据
      } else {
        // 即使没有新数据，也更新检查时间和hasMore状态
        setHasMore(response.meta?.has_next || false)
        setLastCheckTime(Date.now())
        return false // 没有新数据
      }
    } catch (error) {
      console.error("加载新数据失败:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // 向上加载更旧的数据
  const loadOlderData = async () => {
    if (isLoading) return false

    try {
      setIsLoading(true)
      const firstLesson = lessons[0]
      if (!firstLesson) return false
      
      // 使用第一条数据的ID作为beginID，向前查询
      const response = await getLessons("", firstLesson.id.toString(), 20, false, false)
      
      const olderLessons = response.data || []
      
      if (olderLessons.length > 0) {
        setLessons(prev => {
          const combinedLessons = [...olderLessons, ...prev]
          
          // 实现滑动窗口：如果超过最大缓存数量，移除最新的数据
          if (combinedLessons.length > MAX_CACHED_ITEMS) {
            const trimmedLessons = combinedLessons.slice(0, MAX_CACHED_ITEMS)
            return trimmedLessons
          } else {
            return combinedLessons
          }
        })
        
        setLastCheckTime(Date.now())
        return true // 有旧数据
      } else {
        setLastCheckTime(Date.now())
        return false // 没有更多旧数据
      }
    } catch (error) {
      console.error("加载旧数据失败:", error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // 检查新数据（兼容性方法）
  const checkForNewData = loadNewerData

    // 加载更多数据
  const loadMoreLessons = async () => {
    if (isLoading) return

    // 对于滑动窗口，我们不能单纯依赖hasMore状态
    // 因为缓存窗口可能不包含最新数据
    const now = Date.now()
    
    // 如果缓存的数据量小于总数量，说明还有数据可以加载
    if (lessons.length < total || (now - lastCheckTime > 120000)) {
      await loadNewerData()
    } else if (!hasMore) {
      // 只有当缓存数据量等于总数且hasMore为false时才提示
      toast.info("已显示全部数据")
    } else {
      // 正常加载更多
      await loadNewerData()
    }
  }

  // 刷新数据
  const refreshData = async () => {
    setSelectedLessons([])
    setHasMore(true) // 重置hasMore状态
    setLastCheckTime(Date.now())
    setCurrentPageInfo({ startIndex: 0, endIndex: 0 }) // 重置缓存页面信息
    await fetchInitialLessons()
  }

  // 初始化
  React.useEffect(() => {
    fetchInitialLessons()
  }, [])

  // 定期检查新数据（每5分钟检查一次）
  React.useEffect(() => {
    const interval = setInterval(async () => {
      // 只有在页面可见且有数据时才检查
      if (document.visibilityState === 'visible' && lessons.length > 0) {
        const now = Date.now()
        // 如果距离上次检查超过5分钟，检查新数据
        if (now - lastCheckTime > 300000) {
          await loadNewerData()
        }
      }
    }, 300000) // 5分钟检查一次

    return () => clearInterval(interval)
  }, [lessons.length, lastCheckTime])

  // 课件选择
  const handleLessonSelect = (lessonId: number, checked: boolean) => {
    if (checked) {
      setSelectedLessons(prev => [...prev, lessonId])
    } else {
      setSelectedLessons(prev => prev.filter(id => id !== lessonId))
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    setSelectedLessons(checked ? lessons.map(lesson => lesson.id) : [])
  }

  // 删除课件
  const handleDeleteLesson = async (id: string, updatedAt: string) => {
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
  }

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
              (共{total}个课件, 已缓存{lessons.length}个)
            </span>
          </div>
          <div className="flex items-center gap-2">
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
              {/* 这里可以添加批量操作按钮 */}
            </div>
          </div>
        )}

        {/* 主内容区域 */}
        {isInitialLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="flex items-center space-x-2 fade-in">
              <IconLoader className="h-6 w-6 loading-spinner" />
              <span>加载中...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="text-red-600 mb-2">{error}</div>
              <Button onClick={refreshData} variant="outline">
                重试
              </Button>
            </div>
          </div>
        ) : (
          <VirtualizedLessonTable
            lessons={lessons}
            selectedLessons={selectedLessons}
            onLessonSelect={handleLessonSelect}
            onDeleteLesson={handleDeleteLesson}
            deletingId={deletingId}
            onLoadMore={loadMoreLessons}
            onLoadOlder={loadOlderData}
            hasMore={hasMore}
            isLoading={isLoading}
            onSelectAll={handleSelectAll}
            currentPageInfo={currentPageInfo}
            total={total}
          />
        )}
      </div>
    </AdminLayout>
  )
} 