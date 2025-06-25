import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  BookOpen, 
  Play,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { useUser, useUserInfo } from "~/hooks/use-user";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 课程数据接口
interface Course {
  id: number;
  title: string;
  description: string;
  author_id: number;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  difficulty_level: string;
  estimated_duration: number;
  tags: string;
  cover_image_url: string;
  author?: {
    id: number;
    username: string;
    email: string;
  };
}

// 班级信息接口 - 匹配后端实际返回的字段名
interface ClassData {
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
  students?: Array<{
    id: number;
    username: string;
    email: string;
  }>;
  students_count?: number;
  courses?: Array<{
    id: number;
    title: string;
    description: string;
    author_id: number;
  }>;
  courses_count?: number;
}

// 获取班级信息
async function getClassInfo(classId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/classes/${classId}`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("获取班级信息失败:", error);
    return null;
  }
}

// 获取班级课程列表
async function getClassCourses(classId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/classes/${classId}/courses`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error("获取班级课程列表失败:", error);
    return [];
  }
}

export default function ClassCourses() {
  const params = useParams();
  const classId = params.classId;
  const { userInfo } = useUserInfo();
  const { logout } = useUser();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取班级信息和课程列表
  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [classInfo, coursesData] = await Promise.all([
          getClassInfo(classId),
          getClassCourses(classId)
        ]);
        
        setClassData(classInfo);
        setCourses(coursesData);
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId]);

  // 格式化难度等级
  const formatDifficulty = (level: string) => {
    const levels: { [key: string]: { text: string; color: string } } = {
      beginner: { text: "初级", color: "bg-green-100 text-green-800" },
      intermediate: { text: "中级", color: "bg-yellow-100 text-yellow-800" },
      advanced: { text: "高级", color: "bg-red-100 text-red-800" }
    };
    return levels[level] || { text: level, color: "bg-gray-100 text-gray-800" };
  };

  // 格式化时长
  const formatDuration = (minutes: number) => {
    if (!minutes) return "未知";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? `${mins}分钟` : ''}`;
    }
    return `${mins}分钟`;
  };

  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
      title={classData?.name ? `${classData.name} - 课程列表` : "课程列表"}
      subtitle="查看班级中的所有课程"
    >
      {/* 导航面包屑 */}
      <div className="mb-6">
        <Link 
          to="/www/user/my_classes"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回我的班级
        </Link>
      </div>

      {/* 主要内容 */}
      <div className="space-y-6">
        {/* 班级信息卡片 */}
        {classData && (
          <Card className="fun-card border-blue-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800 mb-2">
                    {classData.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {classData.description || "暂无描述"}
                  </CardDescription>
                </div>
                <Badge 
                  variant={classData.is_active ? "default" : "secondary"}
                  className={classData.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                >
                  {classData.is_active ? "进行中" : "已结束"}
                </Badge>
              </div>
              {classData.teacher && (
                <div className="flex items-center text-sm text-gray-600 mt-4">
                  <GraduationCap className="w-4 h-4 mr-2 text-blue-500" />
                  <span>授课教师：{classData.teacher.username}</span>
                </div>
              )}
            </CardHeader>
          </Card>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-500">加载课程列表中...</p>
          </div>
        )}

        {/* 课程列表 */}
        {!loading && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const difficulty = formatDifficulty(course.difficulty_level);
              return (
                <Card 
                  key={course.id} 
                  className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer border-purple-200 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-bold text-gray-800 mb-2 group-hover:text-purple-600 transition-colors">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-600 line-clamp-3">
                          {course.description || "暂无描述"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {/* 课程信息 */}
                    <div className="space-y-3 mb-4">
                      {/* 作者信息 */}
                      {course.author && (
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="w-4 h-4 mr-2 text-blue-500" />
                          <span>作者：{course.author.username}</span>
                        </div>
                      )}
                      
                      {/* 时长和难度 */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-600">
                          <Clock className="w-4 h-4 mr-1 text-green-500" />
                          <span>{formatDuration(course.estimated_duration)}</span>
                        </div>
                        <Badge className={difficulty.color}>
                          {difficulty.text}
                        </Badge>
                      </div>
                      
                      {/* 标签 */}
                      {course.tags && (
                        <div className="flex flex-wrap gap-1">
                          {course.tags.split(',').filter(tag => tag.trim()).slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Link 
                        to={`/www/user/course_lessons/${course.id}`}
                        className="flex-1"
                      >
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full rounded-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-300"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          开始学习
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 空状态 */}
        {!loading && courses.length === 0 && (
          <Card className="fun-card text-center py-12">
            <CardContent>
              <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-12 h-12 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">这个班级还没有课程</h3>
              <p className="text-gray-600 mb-6">
                请等待老师添加课程，或联系老师了解更多信息。
              </p>
              <div className="bg-purple-50 rounded-lg p-4 inline-block">
                <p className="text-sm text-purple-800">
                  💡 提示：老师添加课程后，你就可以开始学习了
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UserLayout>
  );
} 