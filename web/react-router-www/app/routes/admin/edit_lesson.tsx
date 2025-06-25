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
import { Textarea } from "~/components/ui/textarea"
import { Badge } from "~/components/ui/badge"
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
  project_type: string
  project_id_1: string
  project_id_2: string
  video_path_1: string
  video_path_2: string
  video_path_3: string
  duration: number
  difficulty: string
  created_at: string
  updated_at: string
  course?: {
    id: number
    title: string
    description: string
  }
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
  project_type: z.enum(["python", "scratch"], {
    required_error: "请选择项目类型",
  }),
  project_id_1: z.string().optional(),
  project_id_2: z.string().optional(),
  updated_at: z.number(),
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
    console.log("获取到的课程数据:", data) // 调试信息
    
    // 确保返回的是数组
    const courses = data.data?.data || data.data || []
    console.log("处理后的课程数组:", courses) // 调试信息
    
    if (!Array.isArray(courses)) {
      console.error("课程数据不是数组:", courses)
      return []
    }
    
    return courses
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

// 获取课件详情
async function getLesson(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons/${id}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("获取课件详情失败:", error)
    throw error
  }
}

// 更新课件
async function updateLesson(id: string, lessonData: FormData, files: {
  documentFile?: File
  video1File?: File
  video2File?: File
  video3File?: File
}, clearFlags: {
  clearDocument?: boolean
  clearVideo1?: boolean
  clearVideo2?: boolean
  clearVideo3?: boolean
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

    // 添加清除标志
    Object.entries(clearFlags).forEach(([key, value]) => {
      if (value) {
        formData.append(key, 'true')
      }
    })

    const response = await fetchWithAuth(`${HOST_URL}/api/admin/lessons/${id}`, {
      method: "PUT",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("更新课件失败:", error)
    throw error
  }
}

export default function EditLessonPage() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [courses, setCourses] = React.useState<Course[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [searchKeyword1, setSearchKeyword1] = React.useState("")
  const [searchKeyword2, setSearchKeyword2] = React.useState("")
  const [lesson, setLesson] = React.useState<Lesson | null>(null)
  const [files, setFiles] = React.useState<{
    documentFile?: File
    video1File?: File
    video2File?: File
    video3File?: File
  }>({})
  const [clearFlags, setClearFlags] = React.useState<{
    clearDocument?: boolean
    clearVideo1?: boolean
    clearVideo2?: boolean
    clearVideo3?: boolean
  }>({})

  // 初始化表单
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      difficulty: "beginner",
      duration: 30,
      project_type: "scratch",
      project_id_1: undefined,
      project_id_2: undefined,
      updated_at: 0,
    },
  })

  // 加载数据
  React.useEffect(() => {
    const loadData = async () => {
      if (!lessonId) {
        navigate("/www/admin/list_lessons")
        return
      }

      try {
        setIsLoading(true)
        
        // 并行加载所有数据
        const [courseList, projectList, userList, lessonData] = await Promise.all([
          getCourses(),
          getProjects(),
          getUsers(),
          getLesson(lessonId)
        ])

        console.log("设置课程列表:", courseList) // 调试信息
        console.log("设置项目列表:", projectList) // 调试信息
        console.log("设置用户列表:", userList) // 调试信息
        
        // 确保设置的都是数组
        setCourses(Array.isArray(courseList) ? courseList : [])
        setProjects(Array.isArray(projectList) ? projectList : [])
        setUsers(Array.isArray(userList) ? userList : [])
        
        const lessonInfo = lessonData.data
        setLesson(lessonInfo)

        // 设置表单默认值
        form.reset({
          course_id: lessonInfo.course_id,
          title: lessonInfo.title,
          content: lessonInfo.content || "",
          difficulty: lessonInfo.difficulty,
          duration: lessonInfo.duration,
          
          project_type: (lessonInfo.project_type === "python" || lessonInfo.project_type === "scratch") ? lessonInfo.project_type : "scratch",
          project_id_1: lessonInfo.project_id_1 || "none",
          project_id_2: lessonInfo.project_id_2 || "none",
          updated_at: Math.floor(new Date(lessonInfo.updated_at).getTime() / 1000),
        })
        
      } catch (error) {
        console.error("加载数据失败:", error)
        toast.error("加载课件数据失败")
        navigate("/www/admin/list_lessons")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [lessonId, navigate, form])

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

  // 处理清除现有文件
  const handleFileClear = (fileType: string) => {
    const clearKey = `clear${fileType.replace('File', '').replace(/^\w/, c => c.toUpperCase())}` as keyof typeof clearFlags
    setClearFlags(prev => ({
      ...prev,
      [clearKey]: true
    }))
  }

  // 取消清除现有文件
  const handleFileClearCancel = (fileType: string) => {
    const clearKey = `clear${fileType.replace('File', '').replace(/^\w/, c => c.toUpperCase())}` as keyof typeof clearFlags
    setClearFlags(prev => ({
      ...prev,
      [clearKey]: false
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

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("zh-CN")
    } catch {
      return dateString
    }
  }

  // 提交表单
  async function onSubmit(values: FormData) {
    if (!lessonId) return

    try {
      setIsSubmitting(true)
      
      // 处理项目ID，将 "none" 转换为 undefined
      const processedValues = {
        ...values,
        project_id_1: values.project_id_1 === "none" ? undefined : values.project_id_1,
        project_id_2: values.project_id_2 === "none" ? undefined : values.project_id_2,
      }
      
      const result = await updateLesson(lessonId, processedValues, files, clearFlags)
      
      toast.success("课件更新成功")
      
      // 更新成功后跳转到课件列表页
      setTimeout(() => {
        navigate("/www/admin/list_lessons")
      }, 2000)
    } catch (error) {
      console.error("提交表单失败:", error)
      toast.error("更新失败，请重试")
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

  // 获取现有文件信息
  const getExistingFileInfo = (fileType: string) => {
    if (!lesson) return null
    
    switch (fileType) {
      case 'document':
        return lesson.document_name ? {
          name: lesson.document_name,
          path: lesson.document_path
        } : null
      case 'video1':
        return lesson.video_path_1 ? {
          name: `视频1.${lesson.video_path_1.split('.').pop()}`,
          path: lesson.video_path_1
        } : null
      case 'video2':
        return lesson.video_path_2 ? {
          name: `视频2.${lesson.video_path_2.split('.').pop()}`,
          path: lesson.video_path_2
        } : null
      case 'video3':
        return lesson.video_path_3 ? {
          name: `视频3.${lesson.video_path_3.split('.').pop()}`,
          path: lesson.video_path_3
        } : null
      default:
        return null
    }
  }

  // 获取项目显示文本 - 与下拉列表格式保持一致
  const getProjectDisplayText = (projectId: string | undefined) => {
    if (!projectId || projectId === "none") {
      return "无关联项目"
    }
    
    // 如果项目数据还没有加载完成，显示加载中
    if (!projects || projects.length === 0) {
      return "加载中..."
    }
    
    // 强制类型匹配 - 尝试多种方式查找项目
    const selectedProject = projects.find(p => {
      const pId = String(p.id).trim()
      const searchId = String(projectId).trim()
      return pId === searchId
    })
    
    if (selectedProject) {
      // 显示与下拉列表相同的格式：ID:xx - 项目名 (by 创建者)
      const creator = users.find(user => user.id === selectedProject.user_id)?.nickname || "未知用户"
      return `ID:${selectedProject.id} - ${selectedProject.name} (by ${creator})`
    }
    
    // 如果找不到项目，仍然显示项目ID，但用户可以知道这是一个问题
    return `项目 ${projectId}`
  }



  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-lg mb-4">加载中...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!lesson) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-lg text-red-600 mb-4">课件不存在</p>
            <Button onClick={() => navigate("/www/admin/list_lessons")}>返回课件列表</Button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">编辑课件</h3>
                <p className="text-sm text-muted-foreground">
                  编辑课件信息和资源文件。
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">ID: {lesson.id}</Badge>
                  <Badge variant={lesson.is_published ? "default" : "secondary"}>
                    {lesson.is_published ? "已发布" : "草稿"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    最后更新：{formatDate(lesson.updated_at)}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/www/admin/list_lessons")}
              >
                返回列表
              </Button>
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
                            {Array.isArray(courses) && courses.map((course) => (
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
                          <Select onValueChange={field.onChange} value={field.value}>
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
                  <h4 className="text-md font-medium">项目配置</h4>
                  
                  <FormField
                    control={form.control}
                    name="project_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>项目类型 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择项目类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="scratch">Scratch</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          选择与课件关联的项目类型。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-6">
                    {/* 关联项目 1 */}
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="project_id_1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>关联项目 1</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择项目">
                                    {getProjectDisplayText(field.value)}
                                  </SelectValue>
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
                                    project.name?.toLowerCase().includes(searchKeyword1.toLowerCase()) ||
                                    project.id?.toLowerCase().includes(searchKeyword1.toLowerCase())
                                  )
                                  .map(project => {
                                    const creator = users.find(user => user.id === project.user_id)?.nickname || "未知用户"
                                    return (
                                      <SelectItem key={project.id} value={project.id}>
                                        ID:{project.id} - {project.name} (by {creator})
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
                      
                      {/* 当前选中的项目1显示 */}
                      {form.watch("project_id_1") && form.watch("project_id_1") !== "none" && (
                        <div className="border rounded-lg p-3 bg-muted/50">
                          {(() => {
                            const projectId = form.watch("project_id_1")
                            const selectedProject = projects.find(p => {
                              const pId = String(p.id).trim()
                              const searchId = String(projectId).trim()
                              return pId === searchId
                            })
                            if (!selectedProject) return null
                            const creator = users.find(user => user.id === selectedProject.user_id)?.nickname || "未知用户"
                            return (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    🎮
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{selectedProject.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {selectedProject.id} • 创建者: {creator}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`${HOST_URL}/scratch?project=${selectedProject.id}`, '_blank')}
                                >
                                  打开项目
                                </Button>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                    
                    {/* 关联项目 2 */}
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="project_id_2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>关联项目 2</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择项目">
                                    {getProjectDisplayText(field.value)}
                                  </SelectValue>
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
                                    project.name?.toLowerCase().includes(searchKeyword2.toLowerCase()) ||
                                    project.id?.toLowerCase().includes(searchKeyword2.toLowerCase())
                                  )
                                  .map(project => {
                                    const creator = users.find(user => user.id === project.user_id)?.nickname || "未知用户"
                                    return (
                                      <SelectItem key={project.id} value={project.id}>
                                        ID:{project.id} - {project.name} (by {creator})
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
                      
                      {/* 当前选中的项目2显示 */}
                      {form.watch("project_id_2") && form.watch("project_id_2") !== "none" && (
                        <div className="border rounded-lg p-3 bg-muted/50">
                          {(() => {
                            const projectId = form.watch("project_id_2")
                            const selectedProject = projects.find(p => {
                              const pId = String(p.id).trim()
                              const searchId = String(projectId).trim()
                              return pId === searchId
                            })
                            if (!selectedProject) return null
                            const creator = users.find(user => user.id === selectedProject.user_id)?.nickname || "未知用户"
                            return (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    🎮
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{selectedProject.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {selectedProject.id} • 创建者: {creator}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`${HOST_URL}/scratch?project=${selectedProject.id}`, '_blank')}
                                >
                                  打开项目
                                </Button>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* 文件管理 */}
                <div className="space-y-6">
                  <h4 className="text-md font-medium">资源文件管理</h4>
                  
                  <div className="space-y-6">
                    {/* 课件文档管理 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">课件文档</label>
                      
                      {/* 现有文件 */}
                      {getExistingFileInfo('document') && !clearFlags.clearDocument && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-xs">
                                📄
                              </div>
                              <div>
                                <p className="text-sm font-medium">当前文档: {getExistingFileInfo('document')?.name}</p>
                                <p className="text-xs text-muted-foreground">点击下方更换文档或点击删除按钮移除</p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`${HOST_URL}/files/${getExistingFileInfo('document')?.path}/preview`, '_blank')}
                              >
                                预览
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleFileClear('documentFile')}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* 清除确认 */}
                      {clearFlags.clearDocument && (
                        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                          <p className="text-sm text-red-800 mb-2">⚠️ 将在保存时删除现有文档</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileClearCancel('documentFile')}
                          >
                            取消删除
                          </Button>
                        </div>
                      )}
                      
                      {/* 新文件上传 */}
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
                                  <p className="text-sm font-medium">
                                    {getExistingFileInfo('document') ? '更换课件文档' : '上传课件文档'}
                                  </p>
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
                    
                    {/* 教学视频管理 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'video1File', index: 1, type: 'video1' },
                        { key: 'video2File', index: 2, type: 'video2' },
                        { key: 'video3File', index: 3, type: 'video3' }
                      ].map(({ key, index, type }) => {
                        const existingFile = getExistingFileInfo(type)
                        const clearKey = `clear${type.replace('video', 'Video')}` as keyof typeof clearFlags
                        
                        return (
                          <div key={key} className="space-y-2">
                            <label className="text-sm font-medium">教学视频 {index}</label>
                            
                            {/* 现有文件 */}
                            {existingFile && !clearFlags[clearKey] && (
                              <div className="border rounded p-2 bg-muted/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1">
                                    <div className="w-6 h-6 bg-red-100 rounded flex items-center justify-center text-xs">
                                      🎥
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">{existingFile.name}</p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="text-xs h-6 px-2"
                                    onClick={() => handleFileClear(key)}
                                  >
                                    删除
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* 清除确认 */}
                            {clearFlags[clearKey] && (
                              <div className="border border-red-200 rounded p-2 bg-red-50">
                                <p className="text-xs text-red-800 mb-1">⚠️ 将删除现有视频</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={() => handleFileClearCancel(key)}
                                >
                                  取消
                                </Button>
                              </div>
                            )}
                            
                            {/* 新文件上传 */}
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                              {files[key as keyof typeof files] ? (
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-xs">
                                      🎥
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {files[key as keyof typeof files]?.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {files[key as keyof typeof files] && formatFileSize(files[key as keyof typeof files]!.size)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleFileRemove(key)}
                                  >
                                    移除
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Input
                                    type="file"
                                    accept=".mp4,.avi,.mov,.wmv,.flv,.mkv"
                                    onChange={(e) => handleFileChange(key, e.target.files?.[0] || null)}
                                    className="hidden"
                                    id={`${key}-upload`}
                                  />
                                  <label htmlFor={`${key}-upload`} className="cursor-pointer">
                                    <div className="flex flex-col items-center space-y-1">
                                      <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-xs">
                                        🎥
                                      </div>
                                      <p className="text-xs font-medium">
                                        {existingFile ? '更换视频' : '上传视频'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {index === 1 ? '主要' : '额外'}视频
                                      </p>
                                    </div>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
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
                    {isSubmitting ? "更新中..." : "更新课件"}
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