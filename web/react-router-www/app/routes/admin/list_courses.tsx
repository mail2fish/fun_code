import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconBook, IconUsers, IconEye, IconCopy } from "@tabler/icons-react"

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
  author_id: number
  is_published: boolean
  sort_order: number
  duration: number
  difficulty: string
  thumbnail_path: string
  created_at: string
  updated_at: string
  lessons_count?: number
  students_count?: number
}

// 课程列表数据类型
interface CoursesData {
  courses: Course[]
  total: number
  showForward: boolean
  showBackward: boolean
  pageSize: number
  currentPage: number
}

// 获取课程列表
async function getCourses(beginID = "0", pageSize = 10, forward = false, asc = false, search = "") {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    if (beginID !== "0") {
      params.append('beginID', beginID.toString())
    }
    if (search.trim()) {
      params.append('search', search.trim())
    }
    
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("获取课程列表失败:", error)
    throw error
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

// 发布/撤销课程
async function publishCourse(id: string, isPublished: boolean, updatedAt: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${id}/publish`, {
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
    console.error("发布课程失败:", error)
    throw error
  }
}

// 复制课程
async function copyCourse(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses/${id}/copy`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("复制课程失败:", error)
    throw error
  }
}

const defaultPageSize = 10 // 每页显示的课程数量

export default function ListCoursePage() {
  const [coursesData, setCoursesData] = React.useState<CoursesData>({
    courses: [],
    total: 0,
    showForward: false,
    showBackward: false,
    currentPage: 1,
    pageSize: defaultPageSize
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [publishingId, setPublishingId] = React.useState<string | null>(null)
  const [copyingId, setCopyingId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")
  // 添加按钮冷却状态
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)

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
    if (duration < 60) {
      return `${duration}分钟`
    }
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }

  // 加载数据
  const fetchCourses = async (beginID = "0", forward = false, asc = false, search = "") => {
    try {
      let page = coursesData.currentPage
      if (beginID === "0") {
        page = 0
      }

      let pageSize = defaultPageSize
      let showForward = false
      let showBackward = false

      setIsLoading(true)
      const response = await getCourses(beginID, pageSize, forward, asc, search)

      // 如果向后翻页
      if (forward) {        
        page++
        if (response.meta.has_next) {
          showForward = true
        }
        if (page > 1) {
          showBackward = true
        }
      // 如果向前翻页
      } else {
        page--
        if (page > 1) {
          showBackward = true
        }
        // 只有在有更多数据或不是第一页时才显示向前按钮
        showForward = response.meta.has_next || page > 0
      }

      setCoursesData({
        courses: response.data || [],
        total: response.meta.total || 0,
        showForward: showForward,
        showBackward: showBackward,
        currentPage: page,
        pageSize: defaultPageSize
      })
      setError(null)
    } catch (error) {
      console.error("加载数据失败:", error)
      setError("加载课程列表失败")
      setCoursesData({
        courses: [],
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

  // 初始加载
  React.useEffect(() => {
    fetchCourses("0", false, false, searchQuery)
  }, [searchQuery])

  // 翻页处理
  const handlePageChange = (beginID: string, forward: boolean, asc: boolean) => {
    fetchCourses(beginID, forward, asc, searchQuery)
  }

  // 删除课程
  const handleDeleteCourse = async (id: string, updatedAt: string) => {
    setDeletingId(id)
    try {
      await deleteCourse(id, updatedAt)
      toast.success("课程删除成功")
      // 重新加载数据
      await fetchCourses("0", false, false, searchQuery)
    } catch (error) {
      console.error("删除课程失败:", error)
      toast.error("删除课程失败")
    } finally {
      setDeletingId(null)
    }
  }

  // 发布/撤销课程
  const handlePublishCourse = async (id: string, isPublished: boolean, updatedAt: string) => {
    setPublishingId(id)
    try {
      await publishCourse(id, !isPublished, updatedAt)
      toast.success(isPublished ? "课程已撤销发布" : "课程已发布")
      // 重新加载数据
      await fetchCourses("0", false, false, searchQuery)
    } catch (error) {
      console.error("发布课程失败:", error)
      toast.error("操作失败")
    } finally {
      setPublishingId(null)
    }
  }

  // 复制课程
  const handleCopyCourse = async (id: string) => {
    setCopyingId(id)
    try {
      await copyCourse(id)
      toast.success("课程复制成功")
      // 重新加载数据
      await fetchCourses("0", false, false, searchQuery)
    } catch (error) {
      console.error("复制课程失败:", error)
      toast.error("复制课程失败")
    } finally {
      setCopyingId(null)
    }
  }

  // 新建课程点击处理
  const handleNewCourseClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 1000)
  }

  // 搜索处理
  const handleSearch = () => {
    setSearchQuery(searchInput)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBook className="h-6 w-6" />
              <h1 className="text-2xl font-bold">课程管理</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="搜索课程..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-64"
                />
                <Button onClick={handleSearch} variant="outline">
                  搜索
                </Button>
              </div>
              <Link 
                to="/www/admin/create_course" 
                onClick={handleNewCourseClick}
                className={isButtonCooling ? 'pointer-events-none' : ''}
              >
                <Button disabled={isButtonCooling}>
                  <IconPlus className="mr-2 h-4 w-4" />
                  新建课程
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
                    <TableHead>课程名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>难度</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>课时数</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coursesData.courses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        {searchQuery ? "没有找到匹配的课程" : "暂无课程数据"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    coursesData.courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.title}</TableCell>
                        <TableCell className="max-w-xs truncate" title={course.description}>
                          {course.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formatDifficulty(course.difficulty)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDuration(course.duration)}</TableCell>
                        <TableCell>
                          <Badge variant={course.is_published ? "default" : "secondary"}>
                            {course.is_published ? "已发布" : "未发布"}
                          </Badge>
                        </TableCell>
                        <TableCell>{course.lessons_count || 0}</TableCell>
                        <TableCell>{formatDate(course.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/www/admin/course_detail/${course.id}`}>
                              <Button variant="ghost" size="sm">
                                <IconEye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to={`/www/admin/edit_course/${course.id}`}>
                              <Button variant="ghost" size="sm">
                                <IconEdit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyCourse(course.id.toString())}
                              disabled={copyingId === course.id.toString()}
                            >
                              <IconCopy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishCourse(course.id.toString(), course.is_published, course.updated_at)}
                              disabled={publishingId === course.id.toString()}
                            >
                              {course.is_published ? "撤销" : "发布"}
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
                                    确定要删除课程 "{course.title}" 吗？此操作不可撤销。
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <DialogClose asChild>
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleDeleteCourse(course.id.toString(), course.updated_at)}
                                      disabled={deletingId === course.id.toString()}
                                    >
                                      {deletingId === course.id.toString() ? "删除中..." : "确认删除"}
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

          {/* 分页控制 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              共 {coursesData.total} 个课程
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstCourse = coursesData.courses[0]
                  if (firstCourse) {
                    handlePageChange(firstCourse.id.toString(), false, false)
                  }
                }}
                disabled={!coursesData.showBackward || isLoading}
              >
                <IconChevronLeft className="h-4 w-4" />
                上一页
              </Button>
              <span className="text-sm">第 {coursesData.currentPage} 页</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastCourse = coursesData.courses[coursesData.courses.length - 1]
                  if (lastCourse) {
                    handlePageChange(lastCourse.id.toString(), true, false)
                  }
                }}
                disabled={!coursesData.showForward || isLoading}
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