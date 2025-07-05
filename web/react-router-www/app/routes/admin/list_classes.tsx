import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconUsers, IconLoader, IconRefresh } from "@tabler/icons-react"

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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
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
  created_at: number // Unix时间戳
  updated_at: number // Unix时间戳
  count_of_students: number // 学生数量
  count_of_courses: number // 课程数量
  teacher?: {
    id: number
    username: string
    nickname: string
    email: string
    role: string
  }
  students?: any[] | null
  courses?: any[] | null
}

// 获取班级列表
async function getClasses(beginID = "0", pageSize = 20, forward = true, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    params.append('beginID', beginID.toString())
    
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/list?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error("获取班级列表失败:", error)
    throw error
  }
}

// 删除班级
async function deleteClass(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/${id}`, {
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

const defaultPageSize = 20 // 每页显示的班级数量

export default function ListClassesPage() {
  // 基础状态
  const [classes, setClasses] = React.useState<Class[]>([])
  const [total, setTotal] = React.useState(0)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  
  // 加载状态
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  
  // 排序控制
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  
  // 防并发和节流控制
  const [lastRequestTime, setLastRequestTime] = React.useState(0)
  const requestInProgress = React.useRef(false)
  const REQUEST_INTERVAL = 300 // 请求间隔300ms

  // 保存当前班级数据的引用，避免循环依赖
  const classesRef = React.useRef<Class[]>([])
  
  // 同步 classes 状态到 ref
  React.useEffect(() => {
    classesRef.current = classes
  }, [classes])

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

  // 数据请求核心函数
  const fetchData = React.useCallback(async ({ 
    direction, 
    reset = false, 
    customBeginID 
  }: { 
    direction: "up" | "down", 
    reset?: boolean, 
    customBeginID?: string 
  }) => {
    const now = Date.now()
    
    // 防并发检查
    if (requestInProgress.current) {
      return
    }
    
    // 时间间隔检查
    if (!reset && now - lastRequestTime < REQUEST_INTERVAL) {
      return
    }
    
    requestInProgress.current = true
    setLastRequestTime(now)
    
    const pageSize = 20
    let beginID = "0"
    let forward = true
    const asc = sortOrder === "asc"
    const currentClasses = classesRef.current
    
    if (reset && customBeginID) {
      beginID = customBeginID
    } else if (!reset && currentClasses.length > 0) {
      if (direction === "up") {
        beginID = currentClasses[0].id.toString()
        forward = false
      } else {
        beginID = currentClasses[currentClasses.length - 1].id.toString()
        forward = true
      }
    }
    
    if (direction === "up") setLoadingTop(true)
    if (direction === "down") setLoadingBottom(true)
    
    try {
      const response = await getClasses(beginID, pageSize, forward, asc)
      const newClasses = response.data || []
      const meta = response.meta || {}
      
      if (reset) {
        setClasses(newClasses)
        setTotal(meta.total || 0)
        // 初始加载时，根据排序方向和数据情况判断是否有更多历史数据
        // 如果是降序（最新优先），初始加载时通常没有更多历史数据
        // 如果是升序（最旧优先），初始加载时可能有更多历史数据
        setHasMoreTop(false)
        setHasMoreBottom(meta.has_next || false)
        setInitialLoading(false)
        return
      }
      
      if (direction === "up") {
        if (newClasses.length === 0) {
          setHasMoreTop(false)
        } else {
          // 记录当前滚动状态
          const container = document.querySelector('.overflow-auto') as HTMLDivElement
          const wasAtTop = container ? container.scrollTop === 0 : false
          
          setClasses(prev => {
            const prevIds = new Set(prev.map(classItem => classItem.id))
            const uniqueNewClasses = newClasses.filter((classItem: Class) => !prevIds.has(classItem.id))
            
            const merged = [...uniqueNewClasses, ...prev]
            const trimmed = merged.slice(0, 50)
            
            return trimmed
          })
          
          // 检查是否有新的唯一数据
          const prevIds = new Set(currentClasses.map(classItem => classItem.id))
          const uniqueCount = newClasses.filter((classItem: Class) => !prevIds.has(classItem.id)).length
          
          if (uniqueCount === 0) {
            setHasMoreTop(false)
          } else {
            setHasMoreBottom(true)
            
            // 调整滚动位置
            if (wasAtTop && container && uniqueCount > 0) {
              setTimeout(() => {
                const rowHeight = 60
                const newScrollTop = rowHeight * 2
                container.scrollTop = newScrollTop
              }, 100)
            }
          }
        }
      } else {
        if (newClasses.length === 0) {
          setHasMoreBottom(false)
        } else {
          setClasses(prev => {
            const prevIds = new Set(prev.map(classItem => classItem.id))
            const uniqueNewClasses = newClasses.filter((classItem: Class) => !prevIds.has(classItem.id))
            
            const merged = [...prev, ...uniqueNewClasses]
            const trimmed = merged.slice(-50)
            
            return trimmed
          })
          
          // 检查是否有新的唯一数据
          const prevIds = new Set(currentClasses.map(classItem => classItem.id))
          const uniqueCount = newClasses.filter((classItem: Class) => !prevIds.has(classItem.id)).length
          
          const newHasMoreBottom = (meta.has_next || false) && uniqueCount > 0
          setHasMoreBottom(newHasMoreBottom)
          
          if (uniqueCount > 0) {
            setHasMoreTop(true)
          }
        }
      }
      
    } catch (error) {
      console.error("API请求失败:", error)
      toast.error("加载数据失败")
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      requestInProgress.current = false
    }
  }, [sortOrder])

  // 初始化数据加载
  const initializeData = React.useCallback(async () => {
    setInitialLoading(true)
    
    // 直接调用API而不是通过fetchData，避免循环依赖
    try {
      const pageSize = 20
      const asc = sortOrder === "asc"
      const response = await getClasses("0", pageSize, true, asc)
      const newClasses = response.data || []
      const meta = response.meta || {}

      setClasses(newClasses)
      setTotal(meta.total || 0)
      setHasMoreTop(false)
      setHasMoreBottom(meta.has_next || false)
      setInitialLoading(false)
    } catch (error) {
      console.error("加载初始数据失败:", error)
      setClasses([])
      setTotal(0)
      setInitialLoading(false)
      toast.error("加载数据失败")
    }
  }, [sortOrder])

  // 滚动处理
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = el
    
    // 简单边界检测
    if (scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
      fetchData({ direction: "up" })
    }
    
    if (scrollHeight - scrollTop - clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
      fetchData({ direction: "down" })
    }
  }

  // 监听排序变化
  React.useEffect(() => {
    if (!initialLoading) {
      const handleSortChange = async () => {
        setHasMoreTop(false)
        setHasMoreBottom(true)
        
        // 直接调用API而不是通过fetchData，避免循环依赖
        try {
          const pageSize = 20
          const asc = sortOrder === "asc"
          const response = await getClasses("0", pageSize, true, asc)
          const newClasses = response.data || []
          const meta = response.meta || {}

          setClasses(newClasses)
          setTotal(meta.total || 0)
          setHasMoreTop(false)
          setHasMoreBottom(meta.has_next || false)
        } catch (error) {
          console.error("加载排序数据失败:", error)
          toast.error("加载数据失败")
        }
      }
      handleSortChange()
    }
  }, [sortOrder, initialLoading])

  // 初始化
  React.useEffect(() => {
    initializeData()
  }, [initializeData])

  // 刷新数据
  const refreshData = React.useCallback(async () => {
    setHasMoreTop(false)
    setHasMoreBottom(true)
    
    // 直接调用API而不是通过fetchData，避免循环依赖
    try {
      const pageSize = 20
      const asc = sortOrder === "asc"
      const response = await getClasses("0", pageSize, true, asc)
      const newClasses = response.data || []
      const meta = response.meta || {}

      setClasses(newClasses)
      setTotal(meta.total || 0)
      setHasMoreTop(false)
      setHasMoreBottom(meta.has_next || false)
      setInitialLoading(false)
    } catch (error) {
      console.error("刷新数据失败:", error)
      toast.error("刷新数据失败")
    }
  }, [sortOrder])

  // 处理删除班级
  const handleDeleteClass = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteClass(id)
      toast.success("班级删除成功")
      // 从列表中移除已删除的班级
      setClasses(prev => prev.filter(classItem => classItem.id.toString() !== id))
      setTotal(prev => prev - 1)
    } catch (error) {
      console.error("删除班级失败:", error)
      toast.error("删除班级失败")
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

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-6 w-6" />
            <h1 className="text-2xl font-bold">班级管理</h1>
            <span className="text-sm text-gray-500">
              (共{total}个, 显示{classes.length}个)
            </span>
            {/* 加载状态指示器 */}
            {(initialLoading || loadingTop || loadingBottom) && (
              <div className="flex items-center gap-1 ml-4 px-2 py-1 bg-blue-100 rounded-full">
                <IconLoader className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-xs text-blue-600">
                  {initialLoading ? "初始化" : loadingTop ? "加载历史" : "加载更多"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 排序控制 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">📅 排序：</span>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">🆕 最新优先</SelectItem>
                  <SelectItem value="asc">⏰ 最旧优先</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 刷新按钮 */}
            <Button variant="outline" size="sm" onClick={refreshData}>
              <IconRefresh className="h-4 w-4 mr-1" />
              刷新
            </Button>
            
            <Button 
              size="sm" 
              asChild
              disabled={isButtonCooling}
            >
              <Link 
                to="/www/admin/create_class" 
                onClick={handleNewClassClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "创建班级"}
              </Link>
            </Button>
          </div>
        </div>

        {/* 主内容区域 */}
        {initialLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="flex items-center space-x-2">
              <IconLoader className="h-6 w-6 animate-spin" />
              <span>加载中...</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border flex flex-col max-h-[70vh]">
            <div 
              className="flex-1 overflow-auto px-1"
              onScroll={handleScroll}
            >
              {/* 向上加载指示器 */}
              {loadingTop && (
                <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
                  <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-blue-700 text-sm">正在加载历史数据...</span>
                </div>
              )}
              
              {/* 顶部提示 */}
              {!loadingTop && hasMoreTop && classes.length > 0 && (
                <div className="flex items-center justify-center py-3 bg-green-50 border border-green-200 rounded-lg mx-4 my-2">
                  <span className="text-green-700 text-sm">
                    📚 还有更多历史班级数据，向上滚动或使用按钮加载
                  </span>
                </div>
              )}

              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>班级名称</TableHead>
                    <TableHead>邀请码</TableHead>
                    <TableHead>开课日期</TableHead>
                    <TableHead>结课日期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>学生数量</TableHead>
                    <TableHead>课程数量</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <div className="empty-state">
                          <IconUsers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-gray-500">没有找到班级，点击右上角"创建班级"按钮创建您的第一个班级</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((classItem) => (
                      <TableRow key={classItem.id}>
                        <TableCell className="font-medium">{classItem.id}</TableCell>
                        <TableCell className="font-medium">
                          <Link to={`/www/admin/classes/${classItem.id}`}>{classItem.name || "未命名班级"}</Link>
                        </TableCell>
                        <TableCell>{classItem.code}</TableCell>
                        <TableCell>{formatDate(classItem.start_date)}</TableCell>
                        <TableCell>{formatDate(classItem.end_date)}</TableCell>
                        <TableCell>
                          <Badge variant={classItem.is_active ? "default" : "secondary"}>
                            {classItem.is_active ? "活跃" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell>{classItem.count_of_students || 0}</TableCell>
                        <TableCell>{classItem.count_of_courses || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="编辑"
                              asChild
                            >
                              <Link to={`/www/admin/edit_class/${classItem.id}`}>
                                <IconEdit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="删除">
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
                  )}
                </TableBody>
              </Table>

              {/* 向下加载指示器 */}
              {loadingBottom && (
                <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
                  <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-blue-700 text-sm">正在加载更多数据...</span>
                </div>
              )}

              {/* 数据状态提示 */}
              {classes.length > 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                  <span className="text-sm">
                    当前显示 {classes.length} 条数据 / 共 {total} 条
                  </span>
                  <span className="text-xs mt-1">
                    ID范围: {classes[0]?.id} ~ {classes[classes.length-1]?.id}
                    {!hasMoreTop && !hasMoreBottom && " (已加载全部)"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}