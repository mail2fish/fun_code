import * as React from "react"
import { useNavigate } from "react-router"
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
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

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
  duration: z.number().min(1, {
    message: "课程时长至少为 1 分钟",
  }).max(10000, {
    message: "课程时长不能超过 10000 分钟",
  }),
  is_published: z.boolean(),
  thumbnail_path: z.string().optional(),
})

// 创建课程
async function createCourse(courseData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(courseData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("创建课程失败:", error)
    throw error
  }
}

export default function CreateCoursePage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

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

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true)
      const result = await createCourse(values)
      
      toast.success("课程创建成功")
      
      // 创建成功后跳转到课程列表页
      setTimeout(() => {
        navigate("/www/admin/list_courses")
      }, 2000)
    } catch (error) {
      console.error("提交表单失败:", error)
      toast.error("创建失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 格式化时长显示
  const formatDuration = (duration: number) => {
    if (duration < 60) {
      return `${duration}分钟`
    }
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">创建新课程</h3>
                <p className="text-sm text-muted-foreground">
                  填写以下信息创建一个新的课程。课程创建后，您可以添加课件内容。
                </p>
              </div>
              <Separator />
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                              placeholder="60"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            当前设置：{formatDuration(form.watch("duration"))}
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
                                    {field.value ? '立即发布' : '保存为草稿'}
                                  </p>
                                  <p className={`text-sm ${
                                    field.value ? 'text-green-600' : 'text-orange-600'
                                  }`}>
                                    {field.value 
                                      ? '课程创建后立即对学生可见，可以报名和学习' 
                                      : '课程创建后对学生隐藏，可稍后发布'
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
                            点击右侧开关来选择课程的发布状态
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "创建中..." : "创建课程"}
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
          </div>
      </div>
    </AdminLayout>
  )
} 