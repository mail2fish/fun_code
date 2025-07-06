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

// 导入拖拽相关组件
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// 导入对话框组件
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command"
import { Checkbox } from "~/components/ui/checkbox"

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

// 获取所有课件列表（用于选择添加到课程）
async function getAllLessons() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons?pageSize=1000`)
    
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

// 批量将课件添加到课程
async function addLessonsToCourse(courseId: string, lessonIds: number[]) {
  try {
    console.log("addLessonsToCourse 调用:", { courseId, lessonIds })
    const url = `${HOST_URL}/api/admin/courses/${courseId}/lessons`
    const body = { lesson_ids: lessonIds }
    console.log("发送请求:", { url, body })
    
    const response = await fetchWithAuth(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    console.log("响应状态:", response.status)
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error("API错误响应:", errorData)
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    const result = await response.json()
    console.log("API成功响应:", result)
    return result
  } catch (error) {
    console.error("添加课件到课程失败:", error)
    throw error
  }
}

// 从课程中移除课件
async function removeLessonFromCourse(courseId: string, lessonId: number) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}/lessons/${lessonId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("从课程移除课件失败:", error)
    throw error
  }
}

// 可拖拽的课件项组件
function SortableLessonItem({ 
  lesson, 
  index, 
  formatDuration,
  onEdit,
  onRemove
}: {
  lesson: LessonData
  index: number
  formatDuration: (duration: number) => string
  onEdit: (lessonId: number) => void
  onRemove: (lessonId: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id.toString() })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-3 p-3 border rounded-lg bg-white transition-all ${
        isDragging ? 'shadow-lg scale-105 rotate-1 bg-blue-50 border-blue-200' : 'hover:shadow-md hover:border-gray-300'
      }`}
    >
      <div 
        {...listeners}
        className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium cursor-grab active:cursor-grabbing hover:bg-muted-foreground/20"
        title="拖拽此处重新排序"
      >
        {index + 1}
      </div>
      <div 
        {...listeners}
        className="flex-1 min-w-0 cursor-grab active:cursor-grabbing"
        title="拖拽此处重新排序"
      >
        <p className="text-sm font-medium truncate">
          {lesson.title}
        </p>
        <p className="text-xs text-muted-foreground">
                                    {formatDuration(lesson.duration)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button 
          size="sm" 
          variant="ghost"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation() // 防止触发拖拽
            console.log('SortableLessonItem 编辑按钮被点击，课件ID:', lesson.id)
            onEdit(lesson.id)
          }}
        >
          编辑
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation() // 防止触发拖拽
            onRemove(lesson.id)
          }}
        >
          移除
        </Button>
      </div>
    </div>
  )
}

export default function EditCoursePage() {
  const navigate = useNavigate()
  const { courseId } = useParams()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [courseData, setCourseData] = React.useState<CourseData | null>(null)
  const [lessons, setLessons] = React.useState<LessonData[]>([])
  const [originalLessons, setOriginalLessons] = React.useState<LessonData[]>([])
  const [hasOrderChanged, setHasOrderChanged] = React.useState(false)
  const [isSavingOrder, setIsSavingOrder] = React.useState(false)

  // 添加已有课件相关状态
  const [allLessons, setAllLessons] = React.useState<LessonData[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])
  const [isLoadingAllLessons, setIsLoadingAllLessons] = React.useState(false)
  const [isAddingLessons, setIsAddingLessons] = React.useState(false)
  const [searchKeyword, setSearchKeyword] = React.useState("")

  // 初始化拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      difficulty: "beginner",
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

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLessons((items) => {
        const oldIndex = items.findIndex((item) => item.id.toString() === active.id)
        const newIndex = items.findIndex((item) => item.id.toString() === over.id)

        const newOrder = arrayMove(items, oldIndex, newIndex)
        
        // 检查顺序是否有变化
        const orderChanged = newOrder.some((lesson, index) => 
          originalLessons[index]?.id !== lesson.id
        )
        setHasOrderChanged(orderChanged)
        
        return newOrder
      })
    }
  }

  // 保存排序
  const handleSaveOrder = async () => {
    if (!courseId || !hasOrderChanged) return

    try {
      setIsSavingOrder(true)
      
      // 构建排序数据
      const orderData = lessons.map((lesson, index) => ({
        id: lesson.id,
        sort_order: index + 1
      }))

      const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${courseId}/lessons/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lessons: orderData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "保存排序失败")
      }

      // 更新原始顺序
      setOriginalLessons([...lessons])
      setHasOrderChanged(false)
      toast.success("课件排序已保存")
      
    } catch (error) {
      console.error("保存排序失败:", error)
      toast.error("保存排序失败，请重试")
    } finally {
      setIsSavingOrder(false)
    }
  }

  // 重置排序
  const handleResetOrder = () => {
    setLessons([...originalLessons])
    setHasOrderChanged(false)
  }

  // 添加课件处理函数
  const handleAddLesson = () => {
    if (!courseId) return
    navigate(`/www/admin/create_lesson?courseId=${courseId}`)
  }

  // 打开添加已有课件对话框
  const handleOpenAddDialog = async () => {
    try {
      setIsLoadingAllLessons(true)
      const allLessonsData = await getAllLessons()
      
      // 过滤掉已经在当前课程中的课件
      const currentLessonIds = lessons.map(lesson => lesson.id)
      const availableLessons = allLessonsData.filter(lesson => !currentLessonIds.includes(lesson.id))
      
      setAllLessons(availableLessons)
      setIsAddDialogOpen(true)
      setSelectedLessons([])
      setSearchKeyword("")
    } catch (error) {
      console.error("加载课件列表失败:", error)
      toast.error("加载课件列表失败")
    } finally {
      setIsLoadingAllLessons(false)
    }
  }

  // 处理课件选择
  const handleLessonToggle = (lessonId: number) => {
    setSelectedLessons(prev => 
      prev.includes(lessonId) 
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId]
    )
  }

  // 确认添加已有课件
  const handleConfirmAddLessons = async () => {
    console.log("handleConfirmAddLessons 调用:", { courseId, selectedLessons })
    
    if (!courseId || selectedLessons.length === 0) {
      console.log("提前返回:", { courseId, selectedLessonsLength: selectedLessons.length })
      return
    }

    try {
      setIsAddingLessons(true)
      
      // 批量添加所有选中的课件
      const result = await addLessonsToCourse(courseId, selectedLessons)
      
      // 重新加载课程课件列表
      const updatedLessons = await getCourseLessons(courseId)
      setLessons(updatedLessons)
      setOriginalLessons([...updatedLessons])
      
      toast.success(result.message || `成功添加 ${selectedLessons.length} 个课件`)
      setIsAddDialogOpen(false)
      setSelectedLessons([])
      
    } catch (error) {
      console.error("添加课件失败:", error)
      toast.error("添加课件失败，请重试")
    } finally {
      setIsAddingLessons(false)
    }
  }

  // 过滤课件
  const filteredLessons = React.useMemo(() => {
    if (!searchKeyword) return allLessons
    
    return allLessons.filter(lesson => 
      lesson.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      lesson.description.toLowerCase().includes(searchKeyword.toLowerCase())
    )
  }, [allLessons, searchKeyword])

  // 编辑课件处理函数
  const handleEditLesson = (lessonId: number) => {
    console.log('点击编辑课件，ID:', lessonId)
    navigate(`/www/admin/edit_lesson/${lessonId}`)
  }

  // 移除课件处理函数
  const handleRemoveLesson = async (lessonId: number) => {
    if (!courseId) return
    
    // 确认对话框
    if (!window.confirm("确定要从课程中移除这个课件吗？课件本身不会被删除，只是不再属于此课程。")) {
      return
    }

    try {
      await removeLessonFromCourse(courseId, lessonId)
      
      // 重新加载课程课件列表
      const updatedLessons = await getCourseLessons(courseId)
      setLessons(updatedLessons)
      setOriginalLessons([...updatedLessons])
      
      toast.success("课件已从课程中移除")
      
    } catch (error) {
      console.error("移除课件失败:", error)
      toast.error("移除课件失败，请重试")
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
        setOriginalLessons([...courseLessons]) // 保存原始顺序
        
        // 设置表单默认值
        form.reset({
          title: course.title || "",
          description: course.description || "",
          difficulty: (course.difficulty as "beginner" | "intermediate" | "advanced") || "beginner",
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
            <div className="space-y-6">
              {/* 课程信息编辑 */}
              <div className="space-y-6">
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
              
              <Separator />
              
              {/* 课件管理 */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">课件管理</h3>
                    <p className="text-sm text-muted-foreground">
                      管理课程的课件内容和顺序，支持拖拽排序。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleOpenAddDialog}
                          disabled={isLoadingAllLessons}
                        >
                          {isLoadingAllLessons ? "加载中..." : "添加已有课件"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>添加已有课件到课程</DialogTitle>
                          <DialogDescription>
                            选择要添加到当前课程的课件。已经在课程中的课件不会显示。
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {/* 搜索框 */}
                          <div>
                            <Input
                              placeholder="搜索课件标题或描述..."
                              value={searchKeyword}
                              onChange={(e) => setSearchKeyword(e.target.value)}
                            />
                          </div>
                          
                          {/* 课件列表 */}
                          <div className="max-h-96 overflow-y-auto border rounded-lg">
                            {filteredLessons.length === 0 ? (
                              <div className="p-8 text-center text-muted-foreground">
                                {searchKeyword ? "没有找到匹配的课件" : "没有可添加的课件"}
                              </div>
                            ) : (
                              <div className="space-y-2 p-4">
                                {filteredLessons.map((lesson) => (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                    onClick={() => handleLessonToggle(lesson.id)}
                                  >
                                    <Checkbox
                                      checked={selectedLessons.includes(lesson.id)}
                                      onChange={() => handleLessonToggle(lesson.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {lesson.title}
                                      </p>
                                      {lesson.description && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {lesson.description}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                          {formatDuration(lesson.duration)}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                          ID: {lesson.id}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* 选中统计 */}
                          {selectedLessons.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              已选择 {selectedLessons.length} 个课件
                            </div>
                          )}
                        </div>
                        
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(false)}
                            disabled={isAddingLessons}
                          >
                            取消
                          </Button>
                          <Button
                            onClick={handleConfirmAddLessons}
                            disabled={selectedLessons.length === 0 || isAddingLessons}
                          >
                            {isAddingLessons ? "添加中..." : `添加选中的课件 (${selectedLessons.length})`}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleAddLesson}
                    >
                      新建课件
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 课件列表 */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        课件列表 ({lessons.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleResetOrder}
                          disabled={isSavingOrder || !hasOrderChanged}
                        >
                          重置
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveOrder}
                          disabled={isSavingOrder || !hasOrderChanged}
                        >
                          {isSavingOrder ? "保存中..." : "保存排序"}
                        </Button>
                      </div>
                    </div>
                    
                    {lessons.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <p className="text-sm">暂无课件</p>
                        <p className="text-xs mt-1">点击"添加课件"创建第一个课件</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2">
                          💡 提示：拖拽序号或课件名称可以调整顺序，点击"编辑"按钮编辑课件，调整顺序后点击"保存排序"按钮保存更改
                        </div>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={lessons.map(lesson => lesson.id.toString())}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {lessons.map((lesson, index) => (
                                <SortableLessonItem
                                  key={lesson.id}
                                  lesson={lesson}
                                  index={index}
                                  formatDuration={formatDuration}
                                  onEdit={handleEditLesson}
                                  onRemove={handleRemoveLesson}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </div>
                  
                  {/* 课程统计 */}
                  {courseData && (
                    <div className="space-y-3 p-4 bg-muted/50 rounded-lg h-fit">
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
                          <span>{lessons.length}</span>
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
        </div>
      </AdminLayout>
    )
} 