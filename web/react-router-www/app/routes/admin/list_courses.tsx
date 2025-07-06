import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconBook, IconUsers, IconEye, IconCopy, IconLoader, IconRefresh } from "@tabler/icons-react"

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
  created_at: number  // Unix 时间戳
  updated_at: number  // Unix 时间戳
  lessons_count?: number
  students_count?: number
}

// 获取课程列表
async function getCourses(beginID = "0", pageSize = 20, forward = true, asc = false) {
  try {
    const params = new URLSearchParams()
    params.append('pageSize', pageSize.toString())
    params.append('asc', asc.toString())
    params.append('forward', forward.toString())
    params.append('beginID', beginID.toString())
    
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    
    const result = await response.json()
    return result
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
        updated_at: parseInt(updatedAt, 10)
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
        updated_at: parseInt(updatedAt, 10)
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

const defaultPageSize = 20 // 每页显示的课程数量

export default function ListCoursePage() {
  // 基础状态
  const [courses, setCourses] = React.useState<Course[]>([])
  const [total, setTotal] = React.useState(0)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [publishingId, setPublishingId] = React.useState<string | null>(null)
  const [copyingId, setCopyingId] = React.useState<string | null>(null)
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

  // 保存当前课程数据的引用，避免循环依赖
  const coursesRef = React.useRef<Course[]>([])
  
  // 同步 courses 状态到 ref
  React.useEffect(() => {
    coursesRef.current = courses
  }, [courses])

  // 格式化日期
  const formatDate = (timestamp?: number) => {
    if (!timestamp || timestamp === 0) return "未知日期"
    
    try {
      // Unix 时间戳转换为毫秒
      const date = new Date(timestamp * 1000)
      
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

  // fetchData 用 useCallback 包裹，依赖 sortOrder
  const fetchData = React.useCallback(async ({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) => {
    let ignore = false;
    const pageSize = 20;
    let beginID = "0";
    let forward = true;
    const asc = sortOrder === "asc";
    const currentCourses = coursesRef.current;

    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && currentCourses.length > 0) {
      if (direction === "up") {
        beginID = currentCourses[0].id.toString();
        forward = false;
      } else {
        beginID = currentCourses[currentCourses.length - 1].id.toString();
        forward = true;
      }
    }

    if (direction === "up") setLoadingTop(true);
    if (direction === "down") setLoadingBottom(true);

    try {
      const response = await getCourses(beginID, pageSize, forward, asc);
      if (ignore) return;
      const newCourses = response.data || [];
      const meta = response.meta || {};

      if (reset) {
        setCourses(newCourses);
        setTotal(meta.total || 0);
        setHasMoreTop(false);
        setHasMoreBottom(meta.has_next || false);
        setInitialLoading(false);
        return;
      }

      if (direction === "up") {
        if (newCourses.length === 0) {
          setHasMoreTop(false);
        } else {
          setCourses(prev => {
            const prevIds = new Set(prev.map(course => course.id));
            const uniqueNewCourses = newCourses.filter((course: Course) => !prevIds.has(course.id));
            const merged = [...uniqueNewCourses, ...prev];
            const trimmed = merged.slice(0, 50);
            return trimmed;
          });
          const prevIds = new Set(currentCourses.map(course => course.id));
          const uniqueCount = newCourses.filter((course: Course) => !prevIds.has(course.id)).length;
          if (uniqueCount === 0) {
            setHasMoreTop(false);
          } else {
            setHasMoreBottom(true);
          }
        }
      } else {
        if (newCourses.length === 0) {
          setHasMoreBottom(false);
        } else {
          setCourses(prev => {
            const prevIds = new Set(prev.map(course => course.id));
            const uniqueNewCourses = newCourses.filter((course: Course) => !prevIds.has(course.id));
            const merged = [...prev, ...uniqueNewCourses];
            const trimmed = merged.slice(-50);
            return trimmed;
          });
          const prevIds = new Set(currentCourses.map(course => course.id));
          const uniqueCount = newCourses.filter((course: Course) => !prevIds.has(course.id)).length;
          const newHasMoreBottom = (meta.has_next || false) && uniqueCount > 0;
          setHasMoreBottom(newHasMoreBottom);
          if (uniqueCount > 0) {
            setHasMoreTop(true);
          }
        }
      }
    } catch (error) {
      if (!ignore) {
        console.error("API请求失败:", error);
        toast.error("加载数据失败");
      }
    } finally {
      if (!ignore) {
        if (direction === "up") setLoadingTop(false);
        if (direction === "down") setLoadingBottom(false);
      }
    }
    return () => { ignore = true; };
  }, [sortOrder]);

  // 初始化数据加载
  React.useEffect(() => {
    setInitialLoading(true);
    fetchData({ direction: "down", reset: true, customBeginID: "0" });
  }, [fetchData]);

  // 监听排序变化
  React.useEffect(() => {
    if (!initialLoading) {
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
    }
  }, [sortOrder, initialLoading, fetchData]);

  // 刷新数据
  const refreshData = React.useCallback(async () => {
    setHasMoreTop(false);
    setHasMoreBottom(true);
    setInitialLoading(true);
    fetchData({ direction: "down", reset: true, customBeginID: "0" });
  }, [fetchData]);

  // 删除课程
  const handleDeleteCourse = async (id: string, updatedAt: string) => {
    setDeletingId(id)
    try {
      await deleteCourse(id, updatedAt)
      toast.success("课程删除成功")
      // 从列表中移除已删除的课程
      setCourses(prev => prev.filter(course => course.id.toString() !== id))
      setTotal(prev => prev - 1)
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
      // 更新列表中的课程状态
      setCourses(prev => prev.map(course => 
        course.id.toString() === id 
          ? { ...course, is_published: !isPublished, updated_at: Date.now() / 1000 }
          : course
      ))
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
      // 刷新数据以显示新复制的课程
      await refreshData()
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

  // 滚动处理
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop) {
      fetchData({ direction: "up" });
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom) {
      fetchData({ direction: "down" });
    }
  }, [hasMoreTop, hasMoreBottom, loadingTop, loadingBottom, fetchData]);

  // 顶部自动检测，解决向上翻页 scroll 事件未触发的问题
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('.overflow-auto') as HTMLDivElement;
      if (!container) return;
      if (container.scrollTop === 0 && hasMoreTop && !loadingTop) {
        fetchData({ direction: "up" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [courses.length, hasMoreTop, loadingTop, fetchData]);

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconBook className="h-6 w-6" />
            <h1 className="text-2xl font-bold">课程管理</h1>
            <span className="text-sm text-gray-500">
              (共{total}个, 显示{courses.length}个)
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
              {!loadingTop && hasMoreTop && courses.length > 0 && (
                <div className="flex items-center justify-center py-3 bg-green-50 border border-green-200 rounded-lg mx-4 my-2">
                  <span className="text-green-700 text-sm">
                    📚 还有更多历史课程数据，向上滚动或使用按钮加载
                  </span>
                </div>
              )}

              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>课程名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>难度</TableHead>
                    <TableHead>时长</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>课件数</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <div className="empty-state">
                          <IconBook className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-gray-500">暂无课程数据</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.id}</TableCell>
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
                              onClick={() => handlePublishCourse(course.id.toString(), course.is_published, course.updated_at.toString())}
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
                                      onClick={() => handleDeleteCourse(course.id.toString(), course.updated_at.toString())}
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

              {/* 向下加载指示器 */}
              {loadingBottom && (
                <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
                  <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-blue-700 text-sm">正在加载更多数据...</span>
                </div>
              )}

              {/* 数据状态提示 */}
              {courses.length > 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                  <span className="text-sm">
                    当前显示 {courses.length} 条数据 / 共 {total} 条
                  </span>
                  <span className="text-xs mt-1">
                    ID范围: {courses[0]?.id} ~ {courses[courses.length-1]?.id}
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