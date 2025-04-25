import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

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

// 用户类型定义
interface User {
  id: number
  username: string
  nickname: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

// 用户列表数据类型
interface UsersData {
  users: User[]
  total: number
  showForward: boolean
  showBackward: boolean
  pageSize: number
  currentPage: number
}

// 获取用户列表
async function getUsers(beginID = "0", pageSize = 10, forward = false, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    if (beginID !== "0") {
      params.append('beginID', beginID.toString())
    }
    
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("获取用户列表失败:", error)
    throw error
  }
}

// 删除用户
async function deleteUser(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("删除用户失败:", error)
    throw error
  }
}

const defaultPageSize = 10 // 每页显示的用户数量

export default function ListUserPage() {
  const [usersData, setUsersData] = React.useState<UsersData>({
    users: [],
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
  const fetchUsers = async (beginID = "0", forward = false, asc = false) => {
    try {
      let page = usersData.currentPage
      if (beginID === "0") {
        page = 0
      }

      let pageSize = defaultPageSize
      let showForward = false
      let showBackward = false

      setIsLoading(true)
      const response = await getUsers(beginID, pageSize, forward, asc)

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

      setUsersData({
        users: response.data || [],
        total: response.total || 0,
        showForward: showForward,
        showBackward: showBackward,
        currentPage: page,
        pageSize: defaultPageSize
      })
      setError(null)
    } catch (error) {
      console.error("加载数据失败:", error)
      setError("加载用户列表失败")
      setUsersData({
        users: [],
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
      fetchUsers("0", true, false)
      isFirstRender.current = false
    }
  }, [])

  // 处理页码变化
  const handlePageChange = (beginID: string, forward: boolean, asc: boolean) => {
    fetchUsers(beginID, forward, asc)
  }

  // 处理删除用户
  const handleDeleteUser = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteUser(id)
      toast("用户已成功删除")
      // 删除成功后重新加载当前页
      if (usersData.users.length > 1) {
        fetchUsers(usersData.users[0].id.toString(), false, false)
      } else {
        fetchUsers("0", false, false)
      }
    } catch (error) {
      console.error("删除用户失败:", error)
      toast("删除用户时出现错误")
    } finally {
      setDeletingId(null)
    }
  }

  // 处理新建用户按钮点击
  const handleNewUserClick = (e: React.MouseEvent) => {
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
  const totalPages = usersData.total > 0 ? Math.ceil(usersData.total / usersData.pageSize) : 0
  const users = usersData.users
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
                    用户管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>用户列表</BreadcrumbPage>
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
                to="/www/admin/users/create" 
                onClick={handleNewUserClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "创建用户"}
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
                    <TableHead>用户名</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : Array.isArray(users) && users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id || Math.random()}>
                        <TableCell className="font-medium">
                          {user.username}
                        </TableCell>
                        <TableCell>{user.nickname}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell>{formatDate(user.updated_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="编辑"
                              asChild
                            >
                              <Link to={`/www/admin/users/${user.id}/edit`}>
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
                                    您确定要删除用户 "{user.username}" 吗？此操作将永久删除该用户及其所有数据，且无法恢复。
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">取消</Button>
                                  </DialogClose>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleDeleteUser(user.id.toString())}
                                    disabled={deletingId === user.id.toString()}
                                  >
                                    {deletingId === user.id.toString() ? "删除中..." : "删除"}
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
                        没有找到用户，点击右上角"创建用户"按钮创建新用户
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {usersData.total > 0 && (
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  共 {usersData.total} 个用户，共 {totalPages} 页，当前第 {usersData.currentPage} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!usersData.showBackward}
                    onClick={() => handlePageChange(users[0].id.toString(), false, asc)}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!usersData.showForward}
                    onClick={() => handlePageChange(users[users.length - 1].id.toString(), true, asc)}
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
