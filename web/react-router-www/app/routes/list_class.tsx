import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconUsers } from "@tabler/icons-react"

import { AppSidebar } from "~/components/my-app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
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
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 班级类型定义
interface Class {
  id: number
  name: string
  description: string
  code: string
  teacher_id: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  students_count?: number
  courses_count?: number
}

// 班级列表数据类型
interface ClassesData {
  classes: Class[]
  total: number
  showForward: boolean
  showBackward: boolean
  pageSize: number
  currentPage: number
}

// 获取班级列表
async function getClasses(beginID = "0", pageSize = 10, forward = false, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    if (beginID !== "0") {
      params.append('beginID', beginID.toString())
    }
    
    const response = await fetchWithAuth(`${HOST_URL}/api/class/list?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("获取班级列表失败:", error)
    throw error
  }
}

// 删除班级
async function deleteClass(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/classes/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("删除班级失败:", error)
    throw error
  }
}

const defaultPageSize = 10 // 每页显示的班级数量

export default function ListClassPage() {
  const [classesData, setClassesData] = React.useState<ClassesData>({
    classes: [],
    total: 0,
    showForward: false,
    showBackward: false,
    currentPage: 1,
    pageSize: defaultPageSize
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
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

  // 加载数据
  const fetchClasses = async (beginID = "0", forward = false, asc = false) => {
    try {
      let page = classesData.currentPage
      if (beginID === "0") {
        page = 0
      }

      let pageSize = defaultPageSize
      let showForward = false
      let showBackward = false

      setIsLoading(true)
      const response = await getClasses(beginID, pageSize, forward, asc)

      // 如果向后翻页
      if (forward) {        
        page++
        if (response.hasMore) {
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
        showForward = response.hasMore || page > 0
      }

      setClassesData({
        classes: response.data || [],
        total: response.total || 0,
        showForward: showForward,
        showBackward: showBackward,
        currentPage: page,
        pageSize: defaultPageSize
      })
      setError(null)
    } catch (error) {
      console.error("加载数据失败:", error)
      setError("加载班级列表失败")
      setClassesData({
        classes: [],
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
  const isFirstRender = React.useRef(true)
  
  React.useEffect(() => {
    if (isFirstRender.current) {
      fetchClasses("0", true, false)
      isFirstRender.current = false
    }
  }, [])

  // 处理页码变化
  const handlePageChange = (beginID: string, forward: boolean, asc: boolean) => {
    fetchClasses(beginID, forward, asc)
  }

  // 处理删除班级
  const handleDeleteClass = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteClass(id)
      toast("班级已成功删除")
      // 删除成功后重新加载当前页
      if (classesData.classes.length > 0) {
        fetchClasses(classesData.classes[0].id.toString(), false, false)
      } else {
        fetchClasses("0", false, false)
      }
    } catch (error) {
      console.error("删除班级失败:", error)
      toast("删除班级时出现错误")
    } finally {
      setDeletingId(null)
    }
  }

  // 处理新建班级按钮点击
  const handleNewClassClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 2000) // 2秒冷却时间
  }

  // 计算总页数
  const totalPages = classesData.total > 0 ? Math.ceil(classesData.total / classesData.pageSize) : 0
  const classes = classesData.classes
  let asc = false

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    班级管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>班级列表</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto mr-4">
            <Button 
              size="sm" 
              asChild
              disabled={isButtonCooling}
            >
              <Link 
                to="/create_class" 
                onClick={handleNewClassClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "创建班级"}
              </Link>
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-4">
            <div className="rounded-xl overflow-hidden border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>班级名称</TableHead>
                    <TableHead>邀请码</TableHead>
                    <TableHead>开课日期</TableHead>
                    <TableHead>结课日期</TableHead>
                    <TableHead>学生数量</TableHead>
                    <TableHead>课程数量</TableHead>
                    <TableHead className="w-[150px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : Array.isArray(classes) && classes.length > 0 ? (
                    classes.map((classItem) => (
                      <TableRow key={classItem.id || Math.random()}>
                        <TableCell className="font-medium">
                          <Link to={`/www/class/${classItem.id}`}>{classItem.name || "未命名班级"}</Link>
                        </TableCell>
                        <TableCell>{classItem.code}</TableCell>
                        <TableCell>{formatDate(classItem.start_date)}</TableCell>
                        <TableCell>{formatDate(classItem.end_date)}</TableCell>
                        <TableCell>{classItem.students_count || 0}</TableCell>
                        <TableCell>{classItem.courses_count || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="查看学生"
                              asChild
                            >
                              <Link to={`/www/class/${classItem.id}/students`}>
                                <IconUsers className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="编辑"
                              asChild
                            >
                              <Link to={`/www/class/${classItem.id}/edit`}>
                                <IconEdit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="删除">
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>确认删除</DialogTitle>
                                  <DialogDescription>
                                    您确定要删除班级 "{classItem.name}" 吗？此操作将删除所有相关的学生关联和课程安排，但不会删除学生账户和课程内容。此操作无法撤销。
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleDeleteClass(classItem.id.toString())}
                                    disabled={deletingId === classItem.id.toString()}
                                  >
                                    {deletingId === classItem.id.toString() ? "删除中..." : "删除"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        没有找到班级，点击右上角"创建班级"按钮创建您的第一个班级
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {classesData.total > 0 && (
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  共 {classesData.total} 个班级，共 {totalPages} 页，当前第 {classesData.currentPage} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!classesData.showBackward}
                    onClick={() => handlePageChange(classes[0].id.toString(), false, asc)}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!classesData.showForward}
                    onClick={() => handlePageChange(classes[classes.length - 1].id.toString(), true, asc)}
                  >
                    下一页
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}