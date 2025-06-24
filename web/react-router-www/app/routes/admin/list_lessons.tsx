import * as React from "react"
import { Link } from "react-router"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconBook, IconEye, IconFileText, IconGripVertical } from "@tabler/icons-react"

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
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Checkbox } from "~/components/ui/checkbox"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 课件类型定义
interface Lesson {
  id: number
  course_id: number
  title: string
  content: string
  sort_order: number
  is_published: boolean
  document_name: string
  document_path: string
  flow_chart_id: number
  project_type: string
  project_id_1: number
  project_id_2: number
  video_path_1: string
  video_path_2: string
  video_path_3: string
  duration: number
  difficulty: string
  description: string
  created_at: string
  updated_at: string
  course?: {
    id: number
    title: string
    description: string
  }
}

// 课程类型定义
interface Course {
  id: number
  title: string
  description: string
}

// 课件列表数据类型
interface LessonsData {
  lessons: Lesson[]
  total: number
  showForward: boolean
  showBackward: boolean
  pageSize: number
  currentPage: number
}

// 可排序的课件行组件
function SortableLessonRow({ 
  lesson, 
  isSelected, 
  onSelect, 
  onPublish, 
  onDelete, 
  publishingId, 
  deletingId 
}: {
  lesson: Lesson
  isSelected: boolean
  onSelect: (id: number, checked: boolean) => void
  onPublish: (id: string, isPublished: boolean, updatedAt: string) => void
  onDelete: (id: string, updatedAt: string) => void
  publishingId: string | null
  deletingId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

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
  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知日期"
    
    try {
      const date = new Date(dateString)
      
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
      ref={setNodeRef}
      style={style}
      className={isSelected ? "bg-muted/50" : ""}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(lesson.id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <IconGripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{lesson.sort_order}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{lesson.title}</span>
          {lesson.description && (
            <span className="text-sm text-muted-foreground truncate max-w-xs">
              {lesson.description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {lesson.course?.title || `课程 ${lesson.course_id}`}
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {formatDifficulty(lesson.difficulty)}
        </Badge>
      </TableCell>
      <TableCell>{formatDuration(lesson.duration)}</TableCell>
      <TableCell>
        <Badge variant={lesson.is_published ? "default" : "secondary"}>
          {lesson.is_published ? "已发布" : "草稿"}
        </Badge>
      </TableCell>
      <TableCell>{formatDate(lesson.created_at)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/www/admin/edit_lesson/${lesson.id}`}>
              <IconEdit className="h-4 w-4" />
            </Link>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPublish(
              lesson.id.toString(),
              !lesson.is_published,
              lesson.updated_at
            )}
            disabled={publishingId === lesson.id.toString()}
          >
            {lesson.is_published ? (
              <IconEye className="h-4 w-4" />
            ) : (
              <IconFileText className="h-4 w-4" />
            )}
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <IconTrash className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认删除课件</DialogTitle>
                <DialogDescription>
                  你确定要删除课件 "{lesson.title}" 吗？此操作无法撤销。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(lesson.id.toString(), lesson.updated_at)}
                    disabled={deletingId === lesson.id.toString()}
                  >
                    删除
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

// 获取课程列表（用于过滤）
async function getCourses() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses?pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    return data.data.data || []
  } catch (error) {
    console.error("获取课程列表失败:", error)
    return []
  }
}

// 获取课件列表
async function getLessons(courseId = "", beginID = "0", pageSize = 10, forward = false, asc = false) {
  try {
    const params = new URLSearchParams()
    if (courseId) {
      params.append('courseId', courseId)
    }
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    if (beginID !== "0") {
      params.append('beginID', beginID.toString())
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

// 发布/撤销课件
async function publishLesson(id: string, isPublished: boolean, updatedAt: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons/${id}/publish`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        is_published: isPublished,
        updated_at: updatedAt
      })
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("发布课件失败:", error)
    throw error
  }
}

// 重新排序课件
async function reorderLessons(courseId: number, lessonIds: number[]) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons/reorder`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        course_id: courseId,
        lesson_ids: lessonIds
      })
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("排序课件失败:", error)
    throw error
  }
}

const defaultPageSize = 20 // 每页显示的课件数量

export default function ListLessonsPage() {
  const [lessonsData, setLessonsData] = React.useState<LessonsData>({
    lessons: [],
    total: 0,
    showForward: false,
    showBackward: false,
    currentPage: 1,
    pageSize: defaultPageSize
  })
  const [courses, setCourses] = React.useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [publishingId, setPublishingId] = React.useState<string | null>(null)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [isReordering, setIsReordering] = React.useState(false)
  // 添加按钮冷却状态
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)

  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 格式化日期
  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知日期"
    
    try {
      const date = new Date(dateString)
      
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

  // 获取课件列表数据
  const fetchLessons = async (courseId = "", beginID = "0", forward = false, asc = false) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await getLessons(courseId, beginID, defaultPageSize, forward, asc)
      
      // 处理API响应数据结构
      const responseData = response.data || response
      
      setLessonsData({
        lessons: responseData.data || [],
        total: responseData.total || 0,
        showForward: responseData.hasMore || false,
        showBackward: beginID !== "0",
        pageSize: defaultPageSize,
        currentPage: 1 // 这里需要根据实际分页逻辑计算
      })
    } catch (error) {
      console.error("获取课件列表失败:", error)
      setError(error instanceof Error ? error.message : "获取课件列表失败")
      toast.error("获取课件列表失败")
    } finally {
      setIsLoading(false)
    }
  }

  // 初始化数据
  React.useEffect(() => {
    const initData = async () => {
      // 获取课程列表
      const courseList = await getCourses()
      setCourses(courseList)
      
      // 获取课件列表
      await fetchLessons()
    }
    
    initData()
  }, [])

  // 处理课程选择变化
  const handleCourseChange = (courseId: string) => {
    const actualCourseId = courseId === "all" ? "" : courseId
    setSelectedCourse(actualCourseId)
    setSelectedLessons([]) // 清空选择
    fetchLessons(actualCourseId)
  }

  // 处理分页
  const handlePageChange = (beginID: string, forward: boolean, asc: boolean) => {
    fetchLessons(selectedCourse, beginID, forward, asc)
  }

  // 处理拖拽排序
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !selectedCourse) {
      return
    }

    const oldIndex = lessonsData.lessons.findIndex(item => item.id === active.id)
    const newIndex = lessonsData.lessons.findIndex(item => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const newLessons = arrayMove(lessonsData.lessons, oldIndex, newIndex)

    // 立即更新UI
    setLessonsData(prev => ({ ...prev, lessons: newLessons }))

    // 发送排序请求
    try {
      setIsReordering(true)
      const lessonIds = newLessons.map(item => item.id)
      await reorderLessons(Number(selectedCourse), lessonIds)
      toast.success("课件排序已更新")
    } catch (error) {
      console.error("排序失败:", error)
      toast.error("排序失败，请刷新页面")
      // 恢复原始顺序
      await fetchLessons(selectedCourse)
    } finally {
      setIsReordering(false)
    }
  }

  // 处理单个课件选择
  const handleLessonSelect = (lessonId: number, checked: boolean) => {
    setSelectedLessons(prev => 
      checked 
        ? [...prev, lessonId]
        : prev.filter(id => id !== lessonId)
    )
  }

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    setSelectedLessons(checked ? lessonsData.lessons.map(lesson => lesson.id) : [])
  }

  // 批量发布/撤销
  const handleBatchPublish = async (isPublished: boolean) => {
    if (selectedLessons.length === 0) {
      toast.error("请先选择要操作的课件")
      return
    }

    try {
      for (const lessonId of selectedLessons) {
        const lesson = lessonsData.lessons.find(l => l.id === lessonId)
        if (lesson) {
          await publishLesson(lessonId.toString(), isPublished, lesson.updated_at)
        }
      }
      toast.success(`已${isPublished ? '发布' : '撤销发布'}${selectedLessons.length}个课件`)
      setSelectedLessons([])
      await fetchLessons(selectedCourse)
    } catch (error) {
      console.error("批量操作失败:", error)
      toast.error("批量操作失败")
    }
  }

  // 处理删除课件
  const handleDeleteLesson = async (id: string, updatedAt: string) => {
    setDeletingId(id)
    try {
      await deleteLesson(id, updatedAt)
      toast.success("课件删除成功")
      // 重新获取列表
      await fetchLessons(selectedCourse)
    } catch (error) {
      console.error("删除课件失败:", error)
      toast.error("删除课件失败")
    } finally {
      setDeletingId(null)
    }
  }

  // 处理发布/撤销课件
  const handlePublishLesson = async (id: string, isPublished: boolean, updatedAt: string) => {
    setPublishingId(id)
    try {
      await publishLesson(id, isPublished, updatedAt)
      toast.success(isPublished ? "课件发布成功" : "课件撤销发布成功")
      // 重新获取列表
      await fetchLessons(selectedCourse)
    } catch (error) {
      console.error("发布课件失败:", error)
      toast.error("发布课件失败")
    } finally {
      setPublishingId(null)
    }
  }

  // 处理新建课件按钮点击（防止重复点击）
  const handleNewLessonClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => setIsButtonCooling(false), 1000) // 1秒冷却
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-lg text-red-600 mb-4">加载失败: {error}</p>
            <Button onClick={() => fetchLessons(selectedCourse)}>重试</Button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">课件管理</h1>
            <p className="text-muted-foreground">
              管理课程中的课件内容，支持拖拽排序
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedCourse || "all"} onValueChange={handleCourseChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择课程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部课程</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id.toString()}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              asChild 
              onClick={handleNewLessonClick}
              disabled={isButtonCooling}
            >
              <Link to="/www/admin/create_lesson">
                <IconPlus className="mr-2 h-4 w-4" />
                新建课件
              </Link>
            </Button>
          </div>
        </div>

        {/* 批量操作工具栏 */}
        {selectedLessons.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedLessons.length} 个课件
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchPublish(true)}
              >
                批量发布
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchPublish(false)}
              >
                批量撤销
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedLessons([])}
              >
                清空选择
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-md border">
          {selectedCourse && selectedCourse !== "" && lessonsData.lessons.length > 0 ? (
            // 拖拽排序模式（仅在选择了课程时启用）
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedLessons.length === lessonsData.lessons.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="w-[100px]">排序</TableHead>
                    <TableHead>课件标题</TableHead>
                    <TableHead>所属课程</TableHead>
                    <TableHead>难度</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={lessonsData.lessons.map(lesson => lesson.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {lessonsData.lessons.map((lesson) => (
                      <SortableLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        isSelected={selectedLessons.includes(lesson.id)}
                        onSelect={handleLessonSelect}
                        onPublish={handlePublishLesson}
                        onDelete={handleDeleteLesson}
                        publishingId={publishingId}
                        deletingId={deletingId}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          ) : (
            // 普通表格模式
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedLessons.length === lessonsData.lessons.length && lessonsData.lessons.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>课件标题</TableHead>
                  <TableHead>所属课程</TableHead>
                  <TableHead>难度</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : lessonsData.lessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {selectedCourse ? "该课程暂无课件" : "暂无课件"}
                    </TableCell>
                  </TableRow>
                ) : (
                  lessonsData.lessons.map((lesson) => (
                    <TableRow 
                      key={lesson.id}
                      className={selectedLessons.includes(lesson.id) ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedLessons.includes(lesson.id)}
                          onCheckedChange={(checked) => 
                            handleLessonSelect(lesson.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{lesson.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{lesson.title}</span>
                          {lesson.description && (
                            <span className="text-sm text-muted-foreground truncate max-w-xs">
                              {lesson.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lesson.course?.title || `课程 ${lesson.course_id}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {formatDifficulty(lesson.difficulty)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDuration(lesson.duration)}</TableCell>
                      <TableCell>{lesson.sort_order}</TableCell>
                      <TableCell>
                        <Badge variant={lesson.is_published ? "default" : "secondary"}>
                          {lesson.is_published ? "已发布" : "草稿"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(lesson.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/www/admin/edit_lesson/${lesson.id}`}>
                              <IconEdit className="h-4 w-4" />
                            </Link>
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePublishLesson(
                              lesson.id.toString(),
                              !lesson.is_published,
                              lesson.updated_at
                            )}
                            disabled={publishingId === lesson.id.toString()}
                          >
                            {lesson.is_published ? (
                              <IconEye className="h-4 w-4" />
                            ) : (
                              <IconFileText className="h-4 w-4" />
                            )}
                          </Button>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认删除课件</DialogTitle>
                                <DialogDescription>
                                  你确定要删除课件 "{lesson.title}" 吗？此操作无法撤销。
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleDeleteLesson(lesson.id.toString(), lesson.updated_at)}
                                    disabled={deletingId === lesson.id.toString()}
                                  >
                                    删除
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* 分页控件 */}
        {lessonsData.lessons.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                共 {lessonsData.total} 个课件
              </p>
              {selectedCourse && (
                <Badge variant="outline">
                  {courses.find(c => c.id.toString() === selectedCourse)?.title || "未知课程"}
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstId = lessonsData.lessons[0]?.id
                  if (firstId && lessonsData.showBackward) {
                    handlePageChange(firstId.toString(), false, false)
                  }
                }}
                disabled={!lessonsData.showBackward || isLoading}
              >
                <IconChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastId = lessonsData.lessons[lessonsData.lessons.length - 1]?.id
                  if (lastId && lessonsData.showForward) {
                    handlePageChange(lastId.toString(), true, false)
                  }
                }}
                disabled={!lessonsData.showForward || isLoading}
              >
                下一页
                <IconChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
} 