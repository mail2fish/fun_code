import * as React from "react"
import { useNavigate, useParams } from "react-router"
import { format, parse } from "date-fns"
import { Edit, ArrowLeft, Users, BookOpen, Calendar, User, Mail, Hash } from "lucide-react"

import { AdminLayout } from "~/components/admin-layout"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Separator } from "~/components/ui/separator"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 班级数据接口
interface ClassData {
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
  teacher?: {
    id: number
    username: string
    email: string
  }
  students?: {
    id: number
    nickname: string
    username: string
    email: string
  }[]
  students_count: number
  courses?: {
    id: number
    title: string
    description: string
    author_id: number
  }[]
  courses_count: number
}

// 获取班级信息
async function getClass(classId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/${classId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API 错误: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data as ClassData;
  } catch (error) {
    console.error("获取班级信息失败:", error);
    throw error;
  }
}

// 格式化日期
const formatDate = (dateString: string) => {
  try {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    return format(date, "yyyy年MM月dd日");
  } catch (error) {
    return dateString;
  }
}

// 格式化时间戳
const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return format(date, "yyyy年MM月dd日 HH:mm");
  } catch (error) {
    return timestamp;
  }
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [classData, setClassData] = React.useState<ClassData | null>(null);

  // 加载班级数据
  React.useEffect(() => {
    if (!classId) {
      setError("班级ID无效");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await getClass(classId);
        
        if (!data || typeof data !== 'object') {
          throw new Error("班级数据格式不正确");
        }
        
        setClassData(data);
        setError(null);
      } catch (error) {
        console.error("加载数据失败:", error);
        setError(error instanceof Error ? error.message : "加载数据失败");
        toast.error("加载数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [classId]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-md bg-destructive/15 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-destructive">加载失败</h3>
                <div className="mt-2 text-sm text-destructive/80">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/www/admin/list_classes")}
                  >
                    返回班级列表
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!classData) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full max-w-4xl">
          <div className="text-center py-8">
            <p className="text-muted-foreground">班级数据不存在</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/www/admin/list_classes")}
            >
              返回班级列表
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-4xl">
        <div className="space-y-6">
          {/* 页面头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/www/admin/list_classes")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>返回班级列表</span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold">{classData.name}</h1>
                <p className="text-muted-foreground">班级详情</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/www/admin/edit_class/${classData.id}`)}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>编辑班级</span>
            </Button>
          </div>

          {/* 班级基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Hash className="h-5 w-5" />
                <span>班级信息</span>
              </CardTitle>
              <CardDescription>
                班级的基本信息和状态
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">班级名称</label>
                  <p className="text-lg font-medium">{classData.name}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">班级代码</label>
                  <p className="text-lg font-mono font-medium">{classData.code}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">班级状态</label>
                  <div>
                    <Badge variant={classData.is_active ? "default" : "secondary"}>
                      {classData.is_active ? "活跃" : "停用"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">任课教师</label>
                  <p className="text-lg">
                    {classData.teacher ? classData.teacher.username : "未分配"}
                  </p>
                </div>
              </div>
              
              {classData.description && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">班级描述</label>
                  <p className="text-sm leading-relaxed">{classData.description}</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>开课日期</span>
                  </label>
                  <p className="text-lg">{formatDate(classData.start_date)}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>结课日期</span>
                  </label>
                  <p className="text-lg">{formatDate(classData.end_date)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">创建时间</label>
                  <p className="text-sm">{formatTimestamp(classData.created_at)}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">更新时间</label>
                  <p className="text-sm">{formatTimestamp(classData.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">学生数量</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{classData.students_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  已加入班级的学生总数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">课程数量</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{classData.courses_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  班级关联的课程总数
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 学生列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>班级学生</span>
              </CardTitle>
              <CardDescription>
                已加入班级的学生列表
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classData.students && classData.students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>姓名</TableHead>
                      <TableHead>用户名</TableHead>
                      <TableHead>邮箱</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classData.students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.nickname || student.username}
                        </TableCell>
                        <TableCell>{student.username}</TableCell>
                        <TableCell>{student.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无学生加入此班级</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 课程列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>班级课程</span>
              </CardTitle>
              <CardDescription>
                班级关联的课程列表
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classData.courses && classData.courses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>课程名称</TableHead>
                      <TableHead>课程描述</TableHead>
                      <TableHead>作者ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classData.courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.title}</TableCell>
                        <TableCell>{course.description}</TableCell>
                        <TableCell>{course.author_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无课程关联到此班级</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
