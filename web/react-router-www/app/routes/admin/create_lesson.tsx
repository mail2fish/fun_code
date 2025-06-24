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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 课程类型定义
interface Course {
  id: number
  title: string
  description: string
}

// 项目类型定义
interface Project {
  id: string
  name: string
  user_id: string
  created_at?: string
  createdAt?: string
}

// 用户类型定义
interface User {
  id: string
  nickname: string
}

// 表单验证 Schema
const formSchema = z.object({
  course_id: z.number({
    required_error: "请选择所属课程",
  }),
  title: z.string().min(2, {
    message: "课件标题至少需要 2 个字符",
  }).max(200, {
    message: "课件标题不能超过 200 个字符",
  }),
  description: z.string().max(1000, {
    message: "课件描述不能超过 1000 个字符",
  }).optional(),
  content: z.string().max(20000, {
    message: "课件内容不能超过 20000 个字符",
  }).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"], {
    required_error: "请选择课件难度",
  }),
  duration: z.number().min(1, {
    message: "课件时长至少为 1 分钟",
  }).max(1000, {
    message: "课件时长不能超过 1000 分钟",
  }),
  project_type: z.string().optional(),
  project_id_1: z.string().optional(),
  project_id_2: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

// 获取课程列表
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

// 获取项目列表
async function getProjects() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects?pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    // 兼容不同接口返回结构
    let projects: Project[] = [];
    if (Array.isArray(data.data)) {
      projects = data.data;
    } else if (Array.isArray(data.data.projects)) {
      projects = data.data.projects;
    }
    return projects
  } catch (error) {
    console.error("获取项目列表失败:", error)
    return []
  }
}

// 获取用户列表
async function getUsers() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    return Array.isArray(data.data) ? data.data : []
  } catch (error) {
    console.error("获取用户列表失败:", error)
    return []
  }
}

// 创建课件
async function createLesson(lessonData: FormData, files: {
  documentFile?: File
  video1File?: File
  video2File?: File
  video3File?: File
}) {
  try {
    const formData = new FormData()
    
    // 添加基本字段
    Object.entries(lessonData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString())
      }
    })
    
    // 添加文件
    if (files.documentFile) {
      formData.append('document_file', files.documentFile)
    }
    if (files.video1File) {
      formData.append('video_1_file', files.video1File)
    }
    if (files.video2File) {
      formData.append('video_2_file', files.video2File)
    }
    if (files.video3File) {
      formData.append('video_3_file', files.video3File)
    }

    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("创建课件失败:", error)
    throw error
  }
}

export default function CreateLessonPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [courses, setCourses] = React.useState<Course[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [searchKeyword1, setSearchKeyword1] = React.useState("")
  const [searchKeyword2, setSearchKeyword2] = React.useState("")
  const [files, setFiles] = React.useState<{
    documentFile?: File
    video1File?: File
    video2File?: File
    video3File?: File
  }>({})

  // 初始化表单
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      content: "",
      difficulty: "beginner",
      duration: 30,
      project_type: "",
      project_id_1: undefined,
      project_id_2: undefined,
    },
  })

  // 加载数据
  React.useEffect(() => {
    const loadData = async () => {
      const [courseList, projectList, userList] = await Promise.all([
        getCourses(),
        getProjects(),
        getUsers()
      ])
      setCourses(courseList)
      setProjects(projectList)
      setUsers(userList)
    }
    loadData()
  }, [])

  // 处理文件上传
  const handleFileChange = (fileType: string, file: File | null) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: file || undefined
    }))
  }

  // 处理文件删除
  const handleFileRemove = (fileType: string) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: undefined
    }))
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 提交表单
  async function onSubmit(values: FormData) {
    try {
      setIsSubmitting(true)
      
      // 处理项目ID，将 "none" 转换为 undefined
      const processedValues = {
        ...values,
        project_id_1: values.project_id_1 === "none" ? undefined : values.project_id_1,
        project_id_2: values.project_id_2 === "none" ? undefined : values.project_id_2,
      }
      
      const result = await createLesson(processedValues, files)
      
      toast.success("课件创建成功")
      
      // 创建成功后跳转到课件列表页
      setTimeout(() => {
        navigate("/www/admin/list_lessons")
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
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">创建新课件</h3>
              <p className="text-sm text-muted-foreground">
                填写以下信息创建一个新的课件。您可以上传文档、视频等资源文件。
              </p>
            </div>
            <Separator />
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* 基本信息 */}
                <div className="space-y-6">
                  <h4 className="text-md font-medium">基本信息</h4>
                  
                  <FormField
                    control={form.control}
                    name="course_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所属课程 *</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(Number(value))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择课程" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {courses.map((course) => (
                              <SelectItem key={course.id} value={course.id.toString()}>
                                {course.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          选择这个课件属于哪个课程。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>课件标题 *</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：第一课：认识Scratch界面" {...field} />
                        </FormControl>
                        <FormDescription>
                          这将是课件的显示名称。
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
                        <FormLabel>课件描述</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="描述这个课件的内容、学习目标等..."
                            className="resize-none min-h-20"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          简要描述课件内容。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>课件内容</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="详细的课件内容、步骤说明、重点提示等..."
                            className="resize-none min-h-40"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          详细的课件正文内容。支持Markdown格式。
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
                          <FormLabel>课件难度 *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择课件难度" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">初级</SelectItem>
                              <SelectItem value="intermediate">中级</SelectItem>
                              <SelectItem value="advanced">高级</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            课件的难度等级。
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
                          <FormLabel>课件时长（分钟）*</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="30"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            预计学习时长：{formatDuration(field.value || 0)}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Separator />
                
                {/* 项目配置 */}
                <div className="space-y-6">
                  <h4 className="text-md font-medium">项目配置（可选）</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="project_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>项目类型</FormLabel>
                          <FormControl>
                            <Input placeholder="scratch" {...field} />
                          </FormControl>
                          <FormDescription>
                            相关的项目类型，如 scratch。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    

                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="project_id_1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>关联项目 1</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择项目" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <div className="px-2 py-1">
                                <input
                                  className="w-full outline-none bg-transparent text-sm px-2 py-1 border rounded-md h-8"
                                  placeholder="搜索项目"
                                  value={searchKeyword1}
                                  onChange={e => setSearchKeyword1(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <SelectItem value="none">无关联项目</SelectItem>
                              {projects
                                .filter(project => 
                                  !searchKeyword1 || 
                                  project.name?.toLowerCase().includes(searchKeyword1.toLowerCase())
                                )
                                .map(project => {
                                  const creator = users.find(user => user.id === project.user_id)?.nickname || "未知用户"
                                  return (
                                    <SelectItem key={project.id} value={project.id}>
                                      {project.name} (by {creator})
                                    </SelectItem>
                                  )
                                })}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            选择与课件关联的第一个项目。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="project_id_2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>关联项目 2</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择项目" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <div className="px-2 py-1">
                                <input
                                  className="w-full outline-none bg-transparent text-sm px-2 py-1 border rounded-md h-8"
                                  placeholder="搜索项目"
                                  value={searchKeyword2}
                                  onChange={e => setSearchKeyword2(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <SelectItem value="none">无关联项目</SelectItem>
                              {projects
                                .filter(project => 
                                  !searchKeyword2 || 
                                  project.name?.toLowerCase().includes(searchKeyword2.toLowerCase())
                                )
                                .map(project => {
                                  const creator = users.find(user => user.id === project.user_id)?.nickname || "未知用户"
                                  return (
                                    <SelectItem key={project.id} value={project.id}>
                                      {project.name} (by {creator})
                                    </SelectItem>
                                  )
                                })}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            选择与课件关联的第二个项目。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Separator />
                
                {/* 文件上传 */}
                <div className="space-y-6">
                  <h4 className="text-md font-medium">资源文件（可选）</h4>
                  
                  <div className="space-y-6">
                    {/* 课件文档上传 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">课件文档</label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                        {files.documentFile ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                📄
                              </div>
                              <div>
                                <p className="text-sm font-medium">{files.documentFile.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(files.documentFile.size)}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleFileRemove('documentFile')}
                            >
                              移除
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx"
                              onChange={(e) => handleFileChange('documentFile', e.target.files?.[0] || null)}
                              className="hidden"
                              id="document-upload"
                            />
                            <label htmlFor="document-upload" className="cursor-pointer">
                              <div className="flex flex-col items-center space-y-2">
                                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                                  📄
                                </div>
                                <div>
                                  <p className="text-sm font-medium">点击上传课件文档</p>
                                  <p className="text-xs text-muted-foreground">
                                    支持 PDF、Word、PowerPoint 格式
                                  </p>
                                </div>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 教学视频上传 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['video1File', 'video2File', 'video3File'].map((fileKey, index) => (
                        <div key={fileKey} className="space-y-2">
                          <label className="text-sm font-medium">教学视频 {index + 1}</label>
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                            {files[fileKey as keyof typeof files] ? (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-xs">
                                    🎥
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {files[fileKey as keyof typeof files]?.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {files[fileKey as keyof typeof files] && formatFileSize(files[fileKey as keyof typeof files]!.size)}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleFileRemove(fileKey)}
                                >
                                  移除
                                </Button>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Input
                                  type="file"
                                  accept=".mp4,.avi,.mov,.wmv,.flv,.mkv"
                                  onChange={(e) => handleFileChange(fileKey, e.target.files?.[0] || null)}
                                  className="hidden"
                                  id={`${fileKey}-upload`}
                                />
                                <label htmlFor={`${fileKey}-upload`} className="cursor-pointer">
                                  <div className="flex flex-col items-center space-y-1">
                                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs">
                                      🎥
                                    </div>
                                    <p className="text-xs font-medium">上传视频</p>
                                    <p className="text-xs text-muted-foreground">
                                      {index === 0 ? '主要' : '额外'}视频
                                    </p>
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/www/admin/list_lessons")}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "创建中..." : "创建课件"}
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