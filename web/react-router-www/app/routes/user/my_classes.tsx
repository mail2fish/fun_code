import { useState, useEffect } from "react";
import { Link } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  Users, 
  BookOpen, 
  Calendar,
  Clock,
  User,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { useUser, useUserInfo } from "~/hooks/use-user";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 班级数据接口
interface Class {
  id: number;
  name: string;
  description: string;
  code: string;
  teacher_id: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  teacher?: {
    id: number;
    username: string;
    email: string;
  };
  students_count?: number;
  courses_count?: number;
}

// 获取我的班级列表
async function getMyClasses() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/classes`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error("获取我的班级列表失败:", error);
    return [];
  }
}

export default function MyClasses() {
  const { userInfo } = useUserInfo();
  const { logout } = useUser();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取班级列表
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const data = await getMyClasses();
        setClasses(data);
      } catch (error) {
        console.error("获取班级列表失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClasses();
  }, []);

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return "未设置";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN');
    } catch {
      return "无效日期";
    }
  };

  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
      title="我的班级"
      subtitle="查看和管理你加入的班级"
    >
      {/* 主要内容 */}
      <div className="space-y-6">
        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-500">加载班级列表中...</p>
          </div>
        )}

        {/* 班级列表 */}
        {!loading && classes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((classItem) => (
              <Card 
                key={classItem.id} 
                className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer border-blue-200 group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                        {classItem.name}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-600 line-clamp-2">
                        {classItem.description || "暂无描述"}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={classItem.is_active ? "default" : "secondary"}
                      className={classItem.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {classItem.is_active ? "进行中" : "已结束"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* 班级信息 */}
                  <div className="space-y-3 mb-4">
                    {/* 教师信息 */}
                    {classItem.teacher && (
                      <div className="flex items-center text-sm text-gray-600">
                        <GraduationCap className="w-4 h-4 mr-2 text-blue-500" />
                        <span>教师：{classItem.teacher.username}</span>
                      </div>
                    )}
                    
                    {/* 班级代码 */}
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2 text-purple-500" />
                      <span>班级代码：{classItem.code}</span>
                    </div>
                    
                    {/* 时间信息 */}
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-green-500" />
                      <span>{formatDate(classItem.start_date)} - {formatDate(classItem.end_date)}</span>
                    </div>
                    
                    {/* 统计信息 */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-600">
                        <Users className="w-4 h-4 mr-1 text-blue-500" />
                        <span>{classItem.students_count || 0} 学生</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <BookOpen className="w-4 h-4 mr-1 text-purple-500" />
                        <span>{classItem.courses_count || 0} 课程</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Link 
                      to={`/www/user/class_courses/${classItem.id}`}
                      className="flex-1"
                    >
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-300"
                      >
                        <BookOpen className="w-4 h-4 mr-2" />
                        查看课程
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && classes.length === 0 && (
          <Card className="fun-card text-center py-12">
            <CardContent>
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">还没有加入任何班级</h3>
              <p className="text-gray-600 mb-6">
                向你的老师询问班级邀请码，开始学习之旅吧！
              </p>
              <div className="bg-blue-50 rounded-lg p-4 inline-block">
                <p className="text-sm text-blue-800">
                  💡 提示：获得班级邀请码后，可以联系管理员将你添加到班级中
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UserLayout>
  );
} 