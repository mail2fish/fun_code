import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconBook, IconFileText } from "@tabler/icons-react"


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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Checkbox } from "~/components/ui/checkbox"
import { toast } from "sonner"

import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

// 课时类型定义
interface Lesson {
  id: number
  course_id: number
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

// 课件行组件
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
        date = new Date(timestamp * 1000) // Unix时间戳需要乘以1000
      } else if (typeof timestamp === 'string') {
        // 如果是纯数字字符串，当作时间戳处理
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
      className={isSelected ? "bg-muted/50" : ""}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(lesson.id, checked as boolean)}
        />
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
        {(lesson.course?.title && lesson.course.title.trim() !== "") ? lesson.course.title : `课程 ${lesson.course_id}`}
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

// 获取课程列表
async function getCourses() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses?pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("获取课程列表失败:", error)
    throw error
  }
}

// 获取课件列表
async function getLessons(courseId = "", beginID = "0", pageSize = 10, forward = false, asc = false) {
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



const defaultPageSize = 10

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
  const [selectedCourse, setSelectedCourse] = React.useState("all")
  const [courseFilter, setCourseFilter] = React.useState("all") // 新增：课程关联筛选
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)



  // 格式化日期
  const formatDate = (timestamp?: string | number) => {
    if (!timestamp) return "未知日期"
    
    try {
      let date: Date
      if (typeof timestamp === 'number') {
        date = new Date(timestamp * 1000) // Unix时间戳需要乘以1000
      } else if (typeof timestamp === 'string') {
        // 如果是纯数字字符串，当作时间戳处理
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

  // 加载数据
  const fetchLessons = async (courseId = "", beginID = "0", forward = false, asc = false) => {
    try {
      setIsLoading(true)
      const response = await getLessons(courseId, beginID, defaultPageSize, forward, asc)

      let page = lessonsData.currentPage
      if (beginID === "0") {
        page = 1
      }

      let showForward = false
      let showBackward = false

      if (forward) {
        page++
        if (response.meta.has_next) {
          showForward = true
        }
        if (page > 1) {
          showBackward = true
        }
      } else {
        page--
        if (page > 1) {
          showBackward = true
        }
        showForward = response.meta.has_next || page > 0
      }

      setLessonsData({
        lessons: response.data || [],
        total: response.meta.total || 0,
        showForward: showForward,
        showBackward: showBackward,
        currentPage: page,
        pageSize: defaultPageSize
      })
      setError(null)
    } catch (error) {
      console.error("加载数据失败:", error)
      setError("加载课件列表失败")
      setLessonsData({
        lessons: [],
        total: 0,
        showForward: false,
        showBackward: false,
        currentPage: 1,
        pageSize: defaultPageSize
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 初始化
  React.useEffect(() => {
    const initData = async () => {
      try {
        const [coursesResponse] = await Promise.all([
          getCourses()
        ])
        setCourses(coursesResponse)
      } catch (error) {
        console.error("初始化数据失败:", error)
        setError("初始化数据失败")
      }
    }

    initData()
  }, [])

  // 当选择课程变化时重新加载数据
  React.useEffect(() => {
    const courseIdToFetch = selectedCourse === "all" ? "" : selectedCourse
    fetchLessons(courseIdToFetch)
  }, [selectedCourse])

  // 课程选择变化
  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId)
    setSelectedLessons([]) // 清空选择
  }

  // 翻页处理
  const handlePageChange = (beginID: string, forward: boolean, asc: boolean) => {
    const courseIdToFetch = selectedCourse === "all" ? "" : selectedCourse
    fetchLessons(courseIdToFetch, beginID, forward, asc)
  }



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
    setSelectedLessons(checked ? filteredLessons.map(lesson => lesson.id) : [])
  }

  // 删除课件
  const handleDeleteLesson = async (id: string, updatedAt: string) => {
    setDeletingId(id)
    try {
      await deleteLesson(id, updatedAt)
      toast.success("课件删除成功")
      const courseIdToFetch = selectedCourse === "all" ? "" : selectedCourse
      await fetchLessons(courseIdToFetch)
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

  // 根据课程关联筛选课件
  const filteredLessons = React.useMemo(() => {
    if (courseFilter === "all") {
      return lessonsData.lessons
    } else if (courseFilter === "with_course") {
      return lessonsData.lessons.filter(lesson => lesson.course_id > 0 && lesson.course?.title)
    } else if (courseFilter === "without_course") {
      return lessonsData.lessons.filter(lesson => lesson.course_id === 0 || !lesson.course?.title)
    }
    return lessonsData.lessons
  }, [lessonsData.lessons, courseFilter])

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBook className="h-6 w-6" />
            <h1 className="text-2xl font-bold">课件管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCourse} onValueChange={handleCourseChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择课程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有课程</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id.toString()}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="课程关联" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="with_course">有课程</SelectItem>
                <SelectItem value="without_course">无课程</SelectItem>
              </SelectContent>
            </Select>
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

        <div className="rounded-md border">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-sm text-muted-foreground">加载中...</div>
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLessons.length === filteredLessons.length && filteredLessons.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-16">序号</TableHead>
                  <TableHead>课件名称</TableHead>
                  <TableHead>所属课程</TableHead>
                  <TableHead>难度</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      {courseFilter === "with_course" ? "暂无有课程关联的课件" : 
                       courseFilter === "without_course" ? "暂无无课程关联的课件" :
                       selectedCourse ? "该课程下暂无课件" : "暂无课件数据"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      isSelected={selectedLessons.includes(lesson.id)}
                      onSelect={handleLessonSelect}
                      onDelete={handleDeleteLesson}
                      deletingId={deletingId}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* 分页控制 */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {lessonsData.total} 个课件
            {courseFilter !== "all" && (
              <span className="ml-2">
                (筛选后: {filteredLessons.length} 个)
              </span>
            )}
            {selectedLessons.length > 0 && (
              <span className="ml-2">
                已选择 {selectedLessons.length} 个
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const firstLesson = lessonsData.lessons[0]
                if (firstLesson) {
                  handlePageChange(firstLesson.id.toString(), false, false)
                }
              }}
              disabled={!lessonsData.showBackward || isLoading}
            >
              <IconChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <span className="text-sm">第 {lessonsData.currentPage} 页</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lastLesson = lessonsData.lessons[lessonsData.lessons.length - 1]
                if (lastLesson) {
                  handlePageChange(lastLesson.id.toString(), true, false)
                }
              }}
              disabled={!lessonsData.showForward || isLoading}
            >
              下一页
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 