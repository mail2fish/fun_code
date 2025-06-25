import * as React from "react"
import { useParams, useNavigate } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AdminLayout } from "~/components/admin-layout"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Toggle } from "~/components/ui/toggle"
import { Textarea } from "~/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth, formatDate } from "~/utils/api"

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
  created_at: number
  updated_at: number
}

// 课件数据接口
interface LessonData {
  id: number
  title: string
  description: string
  course_id: number
  sort_order: number
  duration: number
  is_published: boolean
  created_at: number
  updated_at: number
}

// 表单验证 Schema
const formSchema = z.object({
  title: z.string().min(2, {
    message: "课程标题至少需要 2 个字符",
  }).max(200, {
    message: "课程标题不能超过 200 个字符",
  }),
  description: z.string().max(1000, {
    message: "课程描述不能超过 1000 个字符",
  }).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    required_error: "请选择课程难度",
  }),
  duration: z.coerce.number({
    required_error: "请输入课程时长",
    invalid_type_error: "课程时长必须是数字",
  }).min(1, {
    message: "课程时长至少为 1 分钟",
  }).max(10000, {
    message: "课程时长不能超过 10000 分钟",
  }),
  is_published: z.boolean(),
  thumbnail_path: z.string().optional(),
})

// 获取课程信息
async function getCourse(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }
    
    const data = await response.json()
    return data.data as CourseData
  } catch (error) {
    console.error("获取课程信息失败:", error)
    throw error
  }
}

// 更新课程
async function updateCourse(courseId: string, courseData: z.infer<typeof formSchema>, updatedAt: number) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...courseData,
        updated_at: updatedAt
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("更新课程失败:", error)
    throw error
  }
}

// 获取课程的课件列表
async function getCourseLessons(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}/lessons`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }
    
    const data = await response.json()
    return data.data as LessonData[]
  } catch (error) {
    console.error("获取课件列表失败:", error)
    throw error
  }
}

export default function EditCoursePage() {
  const navigate = useNavigate()
  const { courseId } = useParams()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [courseData, setCourseData] = React.useState<CourseData | null>(null)
  const [lessons, setLessons] = React.useState<LessonData[]>([])

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      difficulty: "beginner",
      duration: 60,
      is_published: false,
      thumbnail_path: "",
    },
  })

  // 格式化时长显示
  const formatDuration = (duration: number) => {
    // 处理无效值
    if (!duration || isNaN(duration) || duration <= 0) {
      return "未设置"
    }
    
    if (duration < 60) {
      return `${duration}分钟`
    }
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
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
        
        // 设置表单默认值
        form.reset({
          title: course.title || "",
          description: course.description || "",
          difficulty: (course.difficulty as "beginner" | "intermediate" | "advanced") || "beginner",
          duration: course.duration && course.duration > 0 ? course.duration : 60,
          is_published: Boolean(course.is_published),
          thumbnail_path: course.thumbnail_path || "",
        })
        
        setError(null)
      } catch (error) {
        console.error("加载课程数据失败:", error)
        setError(error instanceof Error ? error.message : "加载课程数据失败")
        toast.error("加载课程数据失败")
      } finally {
        setIsLoading(false)
      }
    }

    loadCourseData()
  }, [courseId, form])

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!courseId || !courseData) {
      toast.error("课程ID无效")
      return
    }

    try {
      setIsSubmitting(true)
      await updateCourse(courseId, values, courseData.updated_at)
      
      toast.success("课程更新成功")
      
      // 更新成功后跳转到课程列表页
      setTimeout(() => {
        navigate("/www/admin/list_courses")
      }, 2000)
    } catch (error) {
      console.error("提交表单失败:", error)
      toast.error("更新失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-6">
              <div>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-96 mt-2" />
              </div>
              <Separator />
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <h3 className="text-lg font-medium text-red-600 mb-2">加载失败</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate("/www/admin/list_courses")}>
                返回课程列表
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="mx-auto w-full max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：课程信息编辑 */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-medium">编辑课程</h3>
                <p className="text-sm text-muted-foreground">
                  修改课程信息，课程更新后学生将看到最新内容。
                </p>
              </div>
              <Separator />
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>课程标题</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：Scratch 编程入门" {...field} />
                        </FormControl>
                        <FormDescription>
                          这将是课程的显示名称，学生将看到这个标题。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>课程描述</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="描述这个课程的内容、目标、适合人群等..."
                            className="resize-none min-h-24"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          详细描述课程内容，帮助学生了解课程。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="difficulty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>课程难度</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择课程难度" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">初级</SelectItem>
                              <SelectItem value="intermediate">中级</SelectItem>
                              <SelectItem value="advanced">高级</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            根据课程内容选择合适的难度等级。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>预计时长（分钟）</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="请输入时长，如：60"
                              min="1"
                              max="10000"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            当前设置：{formatDuration(form.watch("duration") || 0)}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="thumbnail_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>缩略图路径（可选）</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：/images/course-thumbnail.jpg" {...field} />
                        </FormControl>
                        <FormDescription>
                          课程封面图片的路径，留空将使用默认图片。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="is_published"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border p-4">
                        <FormLabel className="text-base font-medium">
                          发布状态
                        </FormLabel>
                        <div className="mt-3 space-y-3">
                          <div className={`p-4 rounded-lg border-2 transition-all ${
                            field.value 
                              ? 'border-green-200 bg-green-50' 
                              : 'border-orange-200 bg-orange-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  field.value ? 'bg-green-500' : 'bg-orange-500'
                                }`} />
                                <div>
                                  <p className={`font-medium ${
                                    field.value ? 'text-green-800' : 'text-orange-800'
                                  }`}>
                                    {field.value ? '已发布' : '未发布'}
                                  </p>
                                  <p className={`text-sm ${
                                    field.value ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {field.value 
                                      ? '课程对学生可见，可以报名和学习' 
                                      : '课程对学生隐藏，仅管理员可见'
                                    }
                                  </p>
                                </div>
                              </div>
                              <FormControl>
                                <Toggle
                                  pressed={field.value}
                                  onPressedChange={field.onChange}
                                  className={`${
                                    field.value 
                                      ? 'data-[state=on]:bg-green-600 data-[state=on]:text-white' 
                                      : 'data-[state=off]:bg-gray-200'
                                  }`}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormDescription className="text-xs text-muted-foreground">
                            点击右侧开关来切换课程的发布状态
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "更新中..." : "更新课程"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                                              onClick={() => navigate("/www/admin/list_courses")}
                      disabled={isSubmitting}
                    >
                      取消
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
            
            {/* 右侧：课件管理 */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">课件管理</h3>
                <p className="text-sm text-muted-foreground">
                  管理课程的课件内容和顺序。
                </p>
              </div>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    课件列表 ({lessons.length})
                  </span>
                  <Button size="sm" variant="outline">
                    添加课件
                  </Button>
                </div>
                
                {lessons.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">暂无课件</p>
                    <p className="text-xs mt-1">点击"添加课件"创建第一个课件</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lesson.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(lesson.duration)} • {lesson.is_published ? "已发布" : "草稿"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            编辑
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {courseData && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium">课程统计</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>课件数量：</span>
                      <span>{lessons.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>总时长：</span>
                      <span>{formatDuration(lessons.reduce((sum, lesson) => sum + lesson.duration, 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>已发布课件：</span>
                      <span>{lessons.filter(lesson => lesson.is_published).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>课程状态：</span>
                      <span>{courseData.is_published ? "已发布" : "草稿"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
} 