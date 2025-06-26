import * as React from "react"
import { useNavigate, useSearchParams } from "react-router"
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
  const [searchParams] = useSearchParams()
  const courseIdFromParams = searchParams.get('courseId')
  const projectIdFromParams = searchParams.get('projectId')
  const projectNameFromParams = searchParams.get('projectName')
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
      title: projectNameFromParams ? `课件：${decodeURIComponent(projectNameFromParams)}` : "",
      content: projectNameFromParams ? `本课件将基于 Scratch 项目"${decodeURIComponent(projectNameFromParams)}"进行教学。\n\n学习目标：\n- 理解项目的基本概念\n- 掌握相关编程技能\n- 能够独立完成类似项目\n\n教学内容：\n1. 项目分析与介绍\n2. 核心功能实现\n3. 扩展与创新` : "",
      difficulty: "beginner",
      duration: 30,
      project_type: "scratch",
      project_id_1: projectIdFromParams || "none",
      project_id_2: "none",
    },
  })

  // 加载数据
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [courseList, projectList, userList] = await Promise.all([
          getCourses(),
          getProjects(),
          getUsers()
        ])
        
        console.log("设置课程列表:", courseList) // 调试信息
        console.log("设置项目列表:", projectList) // 调试信息
        console.log("设置用户列表:", userList) // 调试信息
        
        // 确保设置的都是数组
        setCourses(Array.isArray(courseList) ? courseList : [])
        setProjects(Array.isArray(projectList) ? projectList : [])
        setUsers(Array.isArray(userList) ? userList : [])

        // 如果URL参数中有courseId，预选择该课程
        if (courseIdFromParams) {
          const courseId = parseInt(courseIdFromParams)
          if (!isNaN(courseId)) {
            form.setValue('course_id', courseId)
          }
        }

        // 如果URL参数中有项目信息，更新表单
        if (projectIdFromParams) {
          form.setValue('project_id_1', projectIdFromParams)
        }
        if (projectNameFromParams) {
          const decodedName = decodeURIComponent(projectNameFromParams)
          form.setValue('title', `课件：${decodedName}`)
          form.setValue('content', `本课件将基于 Scratch 项目"${decodedName}"进行教学。

学习目标：
- 理解项目的基本概念和设计思路
- 掌握项目中使用的编程技能和方法
- 能够独立完成类似的创意项目

教学内容：
1. 项目分析与功能介绍
2. 核心代码块讲解
3. 关键技术点实现
4. 项目扩展与创新思路

学习重点：
- 程序逻辑设计
- 问题解决方法
- 创意思维培养`)
        }
      } catch (error) {
        console.error("初始化数据失败:", error)
        toast.error("加载数据失败，请刷新页面重试")
        // 确保状态是数组
        setCourses([])
        setProjects([])
        setUsers([])
      }
    }
    loadData()
  }, [courseIdFromParams, form])

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

  // 获取项目显示文本
  const getProjectDisplayText = (projectId: string | undefined) => {
    if (!projectId || projectId === "none") {
      return "无关联项目"
    }
    
    // 如果项目数据还没有加载完成，显示加载中
    if (!projects || projects.length === 0) {
      return "加载中..."
    }
    
    const selectedProject = projects.find(p => {
      const pId = String(p.id).trim()
      const searchId = String(projectId).trim()
      return pId === searchId
    })
    
    if (selectedProject) {
      const creator = users.find(user => user.id === selectedProject.user_id)?.nickname || "未知用户"
      return `ID:${selectedProject.id} - ${selectedProject.name} (by ${creator})`
    }
    
    return `项目 ${projectId}`
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
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">创建新课件</h3>
                <p className="text-sm text-muted-foreground">
                  填写以下信息创建一个新的课件。您可以上传文档、视频等资源文件。
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default">新课件</Badge>
                  {projectNameFromParams && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      📚 基于项目：{decodeURIComponent(projectNameFromParams)}
                    </Badge>
                  )}
                </div>
                {projectNameFromParams && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      💡 <strong>提示：</strong>系统已根据选择的 Scratch 项目自动填充了课件标题和内容模板，您可以根据需要进行调整。
                    </p>
                  </div>
                )}
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
                                  预览项目
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
                                  预览项目
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
                      {[
                        { key: 'video1File', index: 1 },
                        { key: 'video2File', index: 2 },
                        { key: 'video3File', index: 3 }
                      ].map(({ key, index }) => (
                        <div key={key} className="space-y-2">
                          <label className="text-sm font-medium">教学视频 {index}</label>
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
                                    <p className="text-xs font-medium">上传视频</p>
                                    <p className="text-xs text-muted-foreground">
                                      {index === 1 ? '主要' : '额外'}视频
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