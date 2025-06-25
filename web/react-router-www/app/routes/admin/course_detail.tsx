import * as React from "react"
import { useNavigate, useParams, Link } from "react-router"
import { IconBook, IconClock, IconEdit, IconTrash, IconPlus, IconEye } from "@tabler/icons-react"

import { AdminLayout } from "~/components/admin-layout"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
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
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 课程数据接口
interface CourseData {
  id: number
  title: string
  description: string
  author_id: number
  is_published: boolean
  sort_order: number
  duration: number
  difficulty: string
  thumbnail_path: string
  created_at: string
  updated_at: string
}

// 课时数据接口
interface LessonData {
  id: number
  title: string
  description: string
  course_id: number
  sort_order: number
  duration: number
  is_published: boolean
  created_at: string
  updated_at: string
}

// 获取课程信息
async function getCourse(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }
    
    const data = await response.json()
    console.log("获取到的课程详情数据:", data) // 调试信息
    
    // 兼容API响应格式
    const course = data.data
    if (!course || !course.id) {
      throw new Error("课程数据格式错误或课程不存在")
    }
    
    // 补充缺失的字段
    const courseData = {
      ...course,
      difficulty: course.difficulty || 'beginner', // API没有返回difficulty，使用默认值
      thumbnail_path: course.thumbnail_path || '', // API没有返回thumbnail_path
      duration: course.stats?.total_duration || course.duration || 0 // 使用stats中的total_duration
    }
    
    return courseData as CourseData
  } catch (error) {
    console.error("获取课程信息失败:", error)
    throw error
  }
}

// 获取课程的课时列表
async function getCourseLessons(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons?courseId=${courseId}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }
    
    const data = await response.json()
    console.log("获取到的课时列表数据:", data) // 调试信息
    
    // 兼容API响应格式
    const lessons = data.data || []
    if (!Array.isArray(lessons)) {
      console.error("课时数据不是数组:", lessons)
      return []
    }
    
    return lessons as LessonData[]
  } catch (error) {
    console.error("获取课时列表失败:", error)
    // 如果获取课时失败，返回空数组而不是抛出错误
    return []
  }
}

// 删除课程
async function deleteCourse(id: string, updatedAt: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${id}`, {
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
    console.error("删除课程失败:", error)
    throw error
  }
}

export default function CourseDetailPage() {
  const navigate = useNavigate()
  const { courseId } = useParams()
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [courseData, setCourseData] = React.useState<CourseData | null>(null)
  const [lessons, setLessons] = React.useState<LessonData[]>([])
  const [isDeleting, setIsDeleting] = React.useState(false)

  // 格式化时长显示
  const formatDuration = (duration: number) => {
    if (duration < 60) {
      return `${duration}分钟`
    }
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
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
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch (error) {
      return "日期格式错误"
    }
  }

  // 加载课程数据
  React.useEffect(() => {
    if (!courseId) {
      setError("课程ID无效")
      setIsLoading(false)
      return
    }

    const loadCourseData = async () => {
      try {
        setIsLoading(true)
        const [course, courseLessons] = await Promise.all([
          getCourse(courseId),
          getCourseLessons(courseId)
        ])
        
        setCourseData(course)
        setLessons(courseLessons)
        setError(null)
      } catch (error) {
        console.error("加载课程数据失败:", error)
        setError("加载课程数据失败，请重试")
      } finally {
        setIsLoading(false)
      }
    }

    loadCourseData()
  }, [courseId])

  // 删除课程处理
  const handleDeleteCourse = async () => {
    if (!courseData || !courseId) return

    try {
      setIsDeleting(true)
      await deleteCourse(courseId, courseData.updated_at)
      
      toast.success("课程删除成功")
      
      // 删除成功后跳转到课程列表页
      setTimeout(() => {
        navigate("/www/admin/list_courses")
      }, 2000)
    } catch (error) {
      console.error("删除课程失败:", error)
      toast.error("删除失败，请重试")
    } finally {
      setIsDeleting(false)
    }
  }

  // 加载状态
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-1 flex-col gap-4">
          <div className="mx-auto w-full max-w-4xl">
            <div className="space-y-6">
              <Skeleton className="h-8 w-64" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
              </div>
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  // 错误状态
  if (error || !courseData) {
    return (
      <AdminLayout>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-red-600 mb-4">{error || "课程不存在"}</p>
              <Button onClick={() => navigate("/www/admin/list_courses")}>
                返回课程列表
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  // 计算总时长
  const totalDuration = lessons.reduce((sum, lesson) => sum + lesson.duration, 0)

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-6">
            {/* 页面标题和操作 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/www/admin/list_courses")}
                >
                  ← 返回列表
                </Button>
                <div className="flex items-center gap-2">
                  <IconBook className="h-6 w-6" />
                  <h1 className="text-2xl font-bold">课程详情</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/www/admin/edit_course/${courseId}`}>
                  <Button>
                    <IconEdit className="mr-2 h-4 w-4" />
                    编辑课程
                  </Button>
                </Link>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <IconTrash className="mr-2 h-4 w-4" />
                      删除课程
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>确认删除课程</DialogTitle>
                      <DialogDescription>
                        确定要删除课程 "{courseData.title}" 吗？此操作不可撤销，将同时删除所有相关的课时内容。
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">取消</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteCourse}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "删除中..." : "确认删除"}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* 课程信息卡片 */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* 基本信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconBook className="h-5 w-5" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">课程标题</label>
                    <p className="text-lg font-semibold">{courseData.title}</p>
                  </div>
                  
                  {courseData.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">课程描述</label>
                      <p className="text-gray-900">{courseData.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">难度等级</label>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {formatDifficulty(courseData.difficulty)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">发布状态</label>
                      <div className="mt-1">
                        <Badge variant={courseData.is_published ? "default" : "secondary"}>
                          {courseData.is_published ? "已发布" : "未发布"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">创建时间</label>
                    <p className="text-gray-900">{formatDate(courseData.created_at)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 统计信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClock className="h-5 w-5" />
                    统计信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">课时数量</label>
                    <p className="text-lg font-semibold">{lessons.length} 个课时</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">预计课程时长</label>
                    <p className="text-lg font-semibold">{formatDuration(courseData.duration)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">实际总时长</label>
                    <p className="text-lg font-semibold">{formatDuration(totalDuration)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">已发布课时</label>
                    <p className="text-lg font-semibold">
                      {lessons.filter(lesson => lesson.is_published).length} / {lessons.length}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">最后更新</label>
                    <p className="text-gray-900">{formatDate(courseData.updated_at)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 课时列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconPlus className="h-5 w-5" />
                    课时列表 ({lessons.length})
                  </CardTitle>
                  <Link to={`/www/admin/edit_course/${courseId}`}>
                    <Button variant="outline" size="sm">
                      <IconPlus className="mr-2 h-4 w-4" />
                      添加课时
                    </Button>
                  </Link>
                </div>
                <CardDescription>
                  课程包含的所有课时内容
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <div className="text-center py-8">
                    <IconBook className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">暂无课时</h3>
                    <p className="mt-1 text-sm text-gray-500">开始创建第一个课时吧！</p>
                    <div className="mt-6">
                      <Link to={`/www/admin/edit_course/${courseId}`}>
                        <Button>
                          <IconPlus className="mr-2 h-4 w-4" />
                          添加课时
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                            {lesson.description && (
                              <p className="text-sm text-gray-500 mt-1">{lesson.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <IconClock className="h-3 w-3" />
                                {formatDuration(lesson.duration)}
                              </span>
                              <Badge 
                                variant={lesson.is_published ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {lesson.is_published ? "已发布" : "未发布"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              navigate(`/www/admin/edit_lesson/${lesson.id}`)
                            }}
                            title="编辑课件"
                          >
                            <IconEdit className="h-4 w-4" />
                            编辑
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 