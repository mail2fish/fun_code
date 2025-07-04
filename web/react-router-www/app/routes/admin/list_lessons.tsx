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

// 去除虚拟化，使用普通表格

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
        
        {/* 顶部提示 - 提醒用户可以获取更多历史数据 */}
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
    console.log(`\n======== 🌐 API请求开始 ========`)
    console.log(`📋 请求参数:`)
    console.log(`  - courseId: "${courseId}"`)
    console.log(`  - beginID: "${beginID}"`)
    console.log(`  - pageSize: ${pageSize}`)
    console.log(`  - forward: ${forward}`)
    console.log(`  - asc: ${asc}`)
    
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    // 始终传递beginID，包括"0"值
    params.append('beginID', beginID.toString())
    if (courseId) {
      params.append('courseId', courseId)
    }
    
    console.log(`🔧 URL参数构造:`)
    console.log(`  - 原始beginID: "${beginID}"`)
    console.log(`  - toString后: "${beginID.toString()}"`)
    console.log(`  - 是否添加beginID: true (强制添加)`)
    console.log(`  - 所有参数: ${params.toString()}`)
    
    const url = `${HOST_URL}/api/admin/lessons?${params.toString()}`
    console.log(`🔗 请求URL: ${url}`)
    console.log(`⏰ 发送时间: ${new Date().toISOString()}`)
    
    const response = await fetchWithAuth(url)
    console.log(`📨 响应状态: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      console.error(`❌ API错误: ${response.status} ${response.statusText}`)
      throw new Error(`API 错误: ${response.status}`)
    }
    
    const result = await response.json()
    console.log(`📦 响应详情:`)
    console.log(`  - 数据条数: ${result.data?.length || 0}`)
    console.log(`  - meta.total: ${result.meta?.total}`)
    console.log(`  - meta.has_next: ${result.meta?.has_next}`)
    if (result.data && result.data.length > 0) {
      const firstItem = result.data[0]
      const lastItem = result.data[result.data.length - 1]
      console.log(`  - 数据ID范围: ${firstItem.id} ~ ${lastItem.id}`)
      console.log(`  - 首条数据: ID=${firstItem.id}, title="${firstItem.title}"`)
      console.log(`  - 末条数据: ID=${lastItem.id}, title="${lastItem.title}"`)
    }
    console.log(`⏰ 响应时间: ${new Date().toISOString()}`)
    console.log(`======== 🌐 API请求结束 ========\n`)
    
    return result
  } catch (error) {
    console.error(`❌ API请求异常:`, error)
    console.log(`======== 🌐 API请求异常结束 ========\n`)
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
  const REQUEST_INTERVAL = 300 // 请求间隔300ms，更快响应

  // 删除localStorage缓存逻辑

  // 保留requestInProgress ref用于防并发控制

  // 数据请求核心函数 - 移除循环依赖
  const fetchData = React.useCallback(async ({ 
    direction, 
    reset = false, 
    customBeginID 
  }: { 
    direction: "up" | "down", 
    reset?: boolean, 
    customBeginID?: string 
  }) => {
    const now = Date.now()
    
    console.log(`\n======== 📡 fetchData 开始 ========`)
    console.log(`🎯 方向: ${direction}`)
    console.log(`🔄 重置: ${reset}`)
    console.log(`📍 自定义beginID: ${customBeginID}`)
    console.log(`⏰ 当前时间: ${now}`)
    console.log(`⏱️ 上次请求时间: ${lastRequestTime}`)
    console.log(`🛡️ 请求进行中: ${requestInProgress.current}`)
    
    // 防并发检查
    if (requestInProgress.current) {
      console.log(`❌ 请求被阻止 - 上一个请求正在进行中`)
      console.log(`======== 📡 fetchData 结束 ========\n`)
      return
    }
    
    // 时间间隔检查 - 但向上翻页时放宽限制
    if (!reset && now - lastRequestTime < REQUEST_INTERVAL) {
      const waitTime = REQUEST_INTERVAL - (now - lastRequestTime)
      console.log(`⚠️ 请求时间间隔检查: ${now - lastRequestTime}ms < ${REQUEST_INTERVAL}ms`)
      console.log(`❌ 请求被阻止 - 时间间隔不足，还需等待 ${waitTime}ms`)
      console.log(`🎯 方向: ${direction}, 上次请求时间: ${lastRequestTime}`)
      console.log(`======== 📡 fetchData 结束 ========\n`)
      return
    }
    
    requestInProgress.current = true
    setLastRequestTime(now)
    
    const pageSize = 20
    let beginID = "0"
    let forward = true
    const asc = sortOrder === "asc"
    const currentLessons = lessons
    
    console.log(`📊 当前数据状态:`)
    console.log(`  - 当前课件数量: ${currentLessons.length}`)
    console.log(`  - 排序方式: ${asc ? 'ASC' : 'DESC'}`)
    console.log(`  - ID范围: ${currentLessons[0]?.id || 'N/A'} ~ ${currentLessons[currentLessons.length-1]?.id || 'N/A'}`)
    
    if (reset && customBeginID) {
      beginID = customBeginID
      console.log(`🎯 使用重置模式，beginID: ${beginID}`)
    } else if (!reset && currentLessons.length > 0) {
      if (direction === "up") {
        beginID = currentLessons[0].id.toString()
        forward = false
        console.log(`⬆️ 向上翻页设置:`)
        console.log(`  - 当前第一条ID: ${currentLessons[0].id}`)
        console.log(`  - 当前最后一条ID: ${currentLessons[currentLessons.length - 1].id}`)
        console.log(`  - 使用beginID: ${beginID}`)
        console.log(`  - forward: ${forward}`)
        console.log(`  - asc: ${asc}`)
      } else {
        beginID = currentLessons[currentLessons.length - 1].id.toString()
        forward = true
        console.log(`⬇️ 向下翻页设置:`)
        console.log(`  - 当前第一条ID: ${currentLessons[0].id}`)
        console.log(`  - 当前最后一条ID: ${currentLessons[currentLessons.length - 1].id}`)
        console.log(`  - 使用beginID: ${beginID}`)
        console.log(`  - forward: ${forward}`)
        console.log(`  - asc: ${asc}`)
      }
    } else {
      console.log(`🚀 初始加载，beginID: ${beginID}`)
    }
    
    if (direction === "up") setLoadingTop(true)
    if (direction === "down") setLoadingBottom(true)
    
    try {
      console.log(`\n🌐 API 请求参数:`)
      console.log(`  - beginID: "${beginID}" (类型: ${typeof beginID})`)
      console.log(`  - pageSize: ${pageSize}`)
      console.log(`  - forward: ${forward}`)
      console.log(`  - asc: ${asc}`)
      console.log(`  - 完整调用: getLessons("", "${beginID}", ${pageSize}, ${forward}, ${asc})`)
      
      const response = await getLessons("", beginID, pageSize, forward, asc)
      const newLessons = response.data || []
      const meta = response.meta || {}
      
      console.log(`\n📥 API 响应:`)
      console.log(`  - 返回数据条数: ${newLessons.length}`)
      console.log(`  - meta.total: ${meta.total}`)
      console.log(`  - meta.has_next: ${meta.has_next}`)
      if (newLessons.length > 0) {
        console.log(`  - 返回数据ID范围: ${newLessons[0]?.id} ~ ${newLessons[newLessons.length-1]?.id}`)
      }
      
      if (reset) {
        console.log(`\n🔄 重置模式处理:`)
        setLessons(newLessons)
        setTotal(meta.total || 0)
        setHasMoreTop(true)
        setHasMoreBottom(meta.has_next || false)
        setInitialLoading(false)
        
        // 重置完成，不需要缓存
        console.log(`  - 设置lessons: ${newLessons.length}条`)
        console.log(`  - 设置total: ${meta.total}`)
        console.log(`  - 设置hasMoreTop: true`)
        console.log(`  - 设置hasMoreBottom: ${meta.has_next}`)
        console.log(`  - 设置initialLoading: false`)
        console.log(`✅ 重置完成`)
        console.log(`======== 📡 fetchData 结束 ========\n`)
        return
      }
      
      if (direction === "up") {
        console.log(`\n⬆️ 向上翻页处理:`)
        if (newLessons.length === 0) {
          console.log(`  - ❌ 向上翻页返回空数据！！！`)
          console.log(`  - ❌ 设置hasMoreTop: false`)
          setHasMoreTop(false)
        } else {
          // 记录当前滚动状态，用于后续调整
          const container = document.querySelector('.overflow-auto') as HTMLDivElement
          const wasAtTop = container ? container.scrollTop === 0 : false
          console.log(`  - 📍 滚动状态检查: 是否在顶部=${wasAtTop}`)
          
          setLessons(prev => {
            // 去重合并：移除重复的ID
            const prevIds = new Set(prev.map(lesson => lesson.id))
            const uniqueNewLessons = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id))
            
            const merged = [...uniqueNewLessons, ...prev]
            // 增加窗口大小到50条，向上翻页保留历史数据
            const trimmed = merged.slice(0, 50)
            
            console.log(`  - 合并前: ${prev.length}条 (${prev[0]?.id}~${prev[prev.length-1]?.id})`)
            console.log(`  - 新数据: ${newLessons.length}条 (${newLessons[0]?.id}~${newLessons[newLessons.length-1]?.id})`)
            console.log(`  - 去重后新数据: ${uniqueNewLessons.length}条`)
            if (uniqueNewLessons.length > 0) {
              console.log(`  - 去重后ID范围: ${uniqueNewLessons[0]?.id}~${uniqueNewLessons[uniqueNewLessons.length-1]?.id}`)
            }
            console.log(`  - 合并后: ${merged.length}条 (${merged[0]?.id}~${merged[merged.length-1]?.id})`)
            console.log(`  - 裁剪到: ${trimmed.length}条 (${trimmed[0]?.id}~${trimmed[trimmed.length-1]?.id})`)
            
            return trimmed
          })
          
          // 检查是否有新的唯一数据
          const prevIds = new Set(lessons.map(lesson => lesson.id))
          const uniqueCount = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id)).length
          
          console.log(`  - 📊 向上翻页返回数据量: ${newLessons.length}/${pageSize}`)
          console.log(`  - 📊 去重后唯一数据量: ${uniqueCount}`)
          
          if (uniqueCount === 0) {
            console.log(`  - ❌ 向上翻页没有新的唯一数据，设置hasMoreTop: false`)
            setHasMoreTop(false)
          } else {
            console.log(`  - ✅ 向上翻页有${uniqueCount}条新数据，保持hasMoreTop: true`)
            // 向上翻页成功且有新数据，重新启用向下翻页
            console.log(`  - 🔄 向上翻页成功，重新启用hasMoreBottom: true`)
            setHasMoreBottom(true)
            
            // 🔧 关键修复：如果用户在顶部加载了新数据，调整滚动位置让用户能继续向上滚动
            if (wasAtTop && container && uniqueCount > 0) {
              console.log(`  - 🎯 检测到顶部加载，调整滚动位置以启用继续滚动`)
              // 延迟调整滚动位置，确保DOM更新完成
              setTimeout(() => {
                // 滚动到一个小的位置（约2行的高度），让用户能继续向上滚动
                const rowHeight = 60 // 估算每行高度
                const newScrollTop = rowHeight * 2
                container.scrollTop = newScrollTop
                console.log(`  - ✅ 已调整滚动位置从0到${newScrollTop}px，现在可以继续向上滚动`)
              }, 100)
            }
          }
          console.log(`  - 向上加载完成`)
        }
      } else {
        console.log(`\n⬇️ 向下翻页处理:`)
        if (newLessons.length === 0) {
          console.log(`  - ❌ 向下翻页返回空数据！！！`)
          console.log(`  - ❌ 设置hasMoreBottom: false`)
          setHasMoreBottom(false)
        } else {
          setLessons(prev => {
            // 去重合并：移除重复的ID
            const prevIds = new Set(prev.map(lesson => lesson.id))
            const uniqueNewLessons = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id))
            
            const merged = [...prev, ...uniqueNewLessons]
            // 增加窗口大小到50条，向下翻页优先保留新数据
            const trimmed = merged.slice(-50)
            
            console.log(`  - 合并前: ${prev.length}条 (${prev[0]?.id}~${prev[prev.length-1]?.id})`)
            console.log(`  - 新数据: ${newLessons.length}条 (${newLessons[0]?.id}~${newLessons[newLessons.length-1]?.id})`)
            console.log(`  - 去重后新数据: ${uniqueNewLessons.length}条`)
            if (uniqueNewLessons.length > 0) {
              console.log(`  - 去重后ID范围: ${uniqueNewLessons[0]?.id}~${uniqueNewLessons[uniqueNewLessons.length-1]?.id}`)
            }
            console.log(`  - 合并后: ${merged.length}条 (${merged[0]?.id}~${merged[merged.length-1]?.id})`)
            console.log(`  - 裁剪到: ${trimmed.length}条 (${trimmed[0]?.id}~${trimmed[trimmed.length-1]?.id})`)
            
            return trimmed
          })
          
          // 检查是否有新的唯一数据
          const prevIds = new Set(lessons.map(lesson => lesson.id))
          const uniqueCount = newLessons.filter((lesson: Lesson) => !prevIds.has(lesson.id)).length
          
          console.log(`  - 📊 向下翻页返回数据量: ${newLessons.length}/${pageSize}`)
          console.log(`  - 📊 去重后唯一数据量: ${uniqueCount}`)
          console.log(`  - API meta.has_next: ${meta.has_next}`)
          
          // 综合判断是否还有更多数据
          const newHasMoreBottom = (meta.has_next || false) && uniqueCount > 0
          console.log(`  - 设置hasMoreBottom: ${newHasMoreBottom}`)
          
          if (uniqueCount === 0) {
            console.log(`  - ❌ 向下翻页没有新的唯一数据，设置hasMoreBottom: false`)
          } else if (!meta.has_next) {
            console.log(`  - ⚠️ API表示无更多数据，设置hasMoreBottom: false`)
          } else {
            console.log(`  - ✅ 向下翻页有${uniqueCount}条新数据且API有更多，保持hasMoreBottom: true`)
          }
          
          setHasMoreBottom(newHasMoreBottom)
          
          // 向下翻页成功且有新数据，重新启用向上翻页
          if (uniqueCount > 0) {
            console.log(`  - 🔄 向下翻页成功，重新启用hasMoreTop: true`)
            setHasMoreTop(true)
          }
          console.log(`  - 向下加载完成`)
        }
      }
      
    } catch (error) {
      console.error(`❌ API请求失败:`, error)
      toast.error("加载数据失败")
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      requestInProgress.current = false
      console.log(`🏁 清理状态: loadingTop/Bottom=false, requestInProgress=false`)
      console.log(`======== 📡 fetchData 结束 ========\n`)
    }
  }, [lessons, sortOrder]) // 添加必要依赖

  // 初始化数据加载
  const initializeData = React.useCallback(async () => {
    console.log(`\n======== 🚀 初始化开始 ========`)
    console.log(`📱 设置initialLoading: true`)
    setInitialLoading(true)
    console.log(`📞 调用fetchData进行初始化(beginID="0")...`)
    await fetchData({ direction: "down", reset: true, customBeginID: "0" })
    console.log(`======== 🚀 初始化结束 ========\n`)
  }, [fetchData])

  // 简化滚动处理 - 模仿project-table.tsx的成功模式
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = el
    
    // 强制输出滚动事件 - 确认事件是否触发
    console.log(`🖱️🖱️🖱️ SCROLL EVENT FIRED! scrollTop=${scrollTop} 🖱️🖱️🖱️`)
    console.log(`📏 scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`)
    console.log(`🎯 检测条件: scrollTop === 0 ? ${scrollTop === 0}`)
    console.log(`🎯 状态检查: hasMoreTop=${hasMoreTop}, loadingTop=${loadingTop}, requestInProgress=${requestInProgress.current}`)
    
    // 简单边界检测 - 完全模仿project-table.tsx
    if (scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
      console.log(`✅✅✅ 触发向上翻页!!! ✅✅✅`)
      fetchData({ direction: "up" })
    } else if (scrollTop === 0) {
      console.log(`❌ 滚动到顶部但翻页被阻止:`)
      console.log(`  - hasMoreTop: ${hasMoreTop}`)
      console.log(`  - loadingTop: ${loadingTop}`)
      console.log(`  - requestInProgress: ${requestInProgress.current}`)
    }
    
    if (scrollHeight - scrollTop - clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
      console.log(`✅✅✅ 触发向下翻页!!! ✅✅✅`)
      fetchData({ direction: "down" })
    }
  }

  // 监听排序变化 - 直接处理，避免额外的useCallback依赖
  React.useEffect(() => {
    console.log(`\n======== 🔄 排序变化useEffect ========`)
    console.log(`🎯 当前sortOrder: ${sortOrder}`)
    console.log(`⏳ initialLoading: ${initialLoading}`)
    
    if (!initialLoading) {
      console.log(`✅ 非初始化状态，开始处理排序变化`)
      const handleSortChange = async () => {
        console.log(`\n🔄 排序变化处理开始:`)
        console.log(`  - 清空选中项`)
        setSelectedLessons([])
        console.log(`  - 重置hasMoreTop: true`)
        setHasMoreTop(true)
        console.log(`  - 重置hasMoreBottom: true`)
        setHasMoreBottom(true)
        console.log(`  - 调用fetchData重新加载数据`)
        await fetchData({ direction: "down", reset: true, customBeginID: "0" })
        console.log(`✅ 排序变化处理完成`)
      }
      handleSortChange()
    } else {
      console.log(`⏸️ 初始化状态，跳过排序变化处理`)
    }
    console.log(`======== 🔄 排序变化useEffect结束 ========\n`)
  }, [sortOrder])

  // 初始化 - 只执行一次
  React.useEffect(() => {
    console.log(`\n======== 🎬 组件挂载useEffect ========`)
    console.log(`🚀 组件首次挂载，开始初始化`)
    console.log(`📞 调用initializeData()`)
    initializeData()
    console.log(`======== 🎬 组件挂载useEffect结束 ========\n`)
  }, []) // 空依赖，只执行一次

  // 原生滚动事件绑定 - 作为React onScroll的备用方案
  React.useEffect(() => {
    console.log(`🔧 开始绑定原生滚动事件监听器`)
    
    const bindScrollListener = () => {
      const container = document.querySelector('.overflow-auto') as HTMLDivElement
      if (!container) {
        console.log(`❌ 找不到滚动容器，稍后重试`)
        return false
      }

      console.log(`✅ 找到滚动容器，绑定原生滚动事件`)
      
      const nativeScrollHandler = (e: Event) => {
        const target = e.target as HTMLDivElement
        const { scrollTop, scrollHeight, clientHeight } = target
        
        console.log(`🌟 原生滚动事件触发！scrollTop=${scrollTop}`)
        
        // 触发向上翻页
        if (scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
          console.log(`🌟 原生事件触发向上翻页`)
          fetchData({ direction: "up" })
        }
        
        // 触发向下翻页  
        if (scrollHeight - scrollTop - clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
          console.log(`🌟 原生事件触发向下翻页`)
          fetchData({ direction: "down" })
        }
      }

      container.addEventListener('scroll', nativeScrollHandler, { passive: true })
      console.log(`🔧 原生滚动事件监听器已绑定`)
      
      return () => {
        container.removeEventListener('scroll', nativeScrollHandler)
        console.log(`🔧 原生滚动事件监听器已移除`)
      }
    }

    // 立即尝试绑定
    const cleanup = bindScrollListener()
    
    // 如果失败，延迟重试
    if (!cleanup) {
      const timer = setTimeout(() => {
        console.log(`🔄 延迟重试绑定滚动事件`)
        bindScrollListener()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
    
    return cleanup
  }, [hasMoreTop, hasMoreBottom, loadingTop, loadingBottom]) // 依赖状态变化时重新绑定

  // 顶部位置自动检测 - 解决滚动条在顶部时无法触发事件的问题
  React.useEffect(() => {
    console.log(`🔍 开始顶部位置自动检测`)
    
    const checkTopPosition = () => {
      const container = document.querySelector('.overflow-auto') as HTMLDivElement
      if (!container) return
      
      const { scrollTop } = container
      
      // 如果在顶部且可以向上加载且没有正在加载
      if (scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
        console.log(`🎯 检测到在顶部且可以向上加载，自动触发向上翻页`)
        fetchData({ direction: "up" })
      }
    }
    
    // 延迟检测，确保DOM渲染完成
    const timer = setTimeout(checkTopPosition, 500)
    
    return () => clearTimeout(timer)
  }, [lessons.length, hasMoreTop, loadingTop]) // 当数据长度变化时重新检测



  // 状态跟踪 - 监控关键状态变化
  const prevHasMoreTop = React.useRef(hasMoreTop)
  const prevHasMoreBottom = React.useRef(hasMoreBottom)
  
  React.useEffect(() => {
    // 检测 hasMore 状态变化
    if (prevHasMoreTop.current !== hasMoreTop) {
      console.log(`🔄 hasMoreTop 状态变化: ${prevHasMoreTop.current} -> ${hasMoreTop}`)
      if (!hasMoreTop) {
        console.log(`⚠️ hasMoreTop被设置为false！检查调用栈...`)
        console.trace()
      }
      prevHasMoreTop.current = hasMoreTop
    }
    
    if (prevHasMoreBottom.current !== hasMoreBottom) {
      console.log(`🔄 hasMoreBottom 状态变化: ${prevHasMoreBottom.current} -> ${hasMoreBottom}`)
      if (!hasMoreBottom) {
        console.log(`⚠️ hasMoreBottom被设置为false！检查调用栈...`)
        console.trace()
      }
      prevHasMoreBottom.current = hasMoreBottom
    }
    
    console.log(`\n======== 📊 状态跟踪 ========`)
    console.log(`📈 当前状态快照:`)
    console.log(`  - lessons.length: ${lessons.length}`)
    console.log(`  - total: ${total}`)
    console.log(`  - hasMoreTop: ${hasMoreTop}`)
    console.log(`  - hasMoreBottom: ${hasMoreBottom}`)
    console.log(`  - loadingTop: ${loadingTop}`)
    console.log(`  - loadingBottom: ${loadingBottom}`)
    console.log(`  - initialLoading: ${initialLoading}`)
    console.log(`  - sortOrder: ${sortOrder}`)
    console.log(`  - selectedLessons.length: ${selectedLessons.length}`)
    console.log(`  - requestInProgress: ${requestInProgress.current}`)
    if (lessons.length > 0) {
      console.log(`  - 数据ID范围: ${lessons[0].id} ~ ${lessons[lessons.length-1].id}`)
    }
    console.log(`======== 📊 状态跟踪结束 ========\n`)
  }, [lessons, total, hasMoreTop, hasMoreBottom, loadingTop, loadingBottom, initialLoading, sortOrder, selectedLessons])

  // 刷新数据
  const refreshData = React.useCallback(async () => {
    console.log(`\n======== 🔄 手动刷新 ========`)
    console.log(`🧹 清空选中项`)
    setSelectedLessons([])
    console.log(`🔄 重置hasMoreTop: true`)
    setHasMoreTop(true)
    console.log(`🔄 重置hasMoreBottom: true`)
    setHasMoreBottom(true)
    console.log(`📞 调用fetchData重新加载`)
    await fetchData({ direction: "down", reset: true, customBeginID: "0" })
    console.log(`======== 🔄 手动刷新完成 ========\n`)
  }, []) // 空依赖，fetchData不会变化

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