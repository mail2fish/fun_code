import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  Play, 
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FileText,
  ExternalLink
} from "lucide-react";
import { useUser, useUserInfo } from "~/hooks/use-user";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 课时数据接口
interface Lesson {
  id: number;
  title: string;
  description: string;
  content: string;
  course_id: number;
  order_index: number;
  duration: number;

  lesson_type: string;
  video_url: string;
  project_1: string;
  project_2: string;
  project_3: string;
  created_at: string;
  updated_at: string;
}

// 课程信息接口
interface Course {
  id: number;
  title: string;
  description: string;
  author_id: number;
  difficulty_level: string;
  estimated_duration: number;
  tags: string;
  author?: {
    id: number;
    username: string;
    email: string;
  };
}

// 获取课程信息
async function getCourseInfo(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/courses/${courseId}`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("获取课程信息失败:", error);
    return null;
  }
}

// 获取课程课时列表
async function getCourseLessons(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/courses/${courseId}/lessons`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error("获取课程课时列表失败:", error);
    return [];
  }
}

export default function CourseLessons() {
  const params = useParams();
  const courseId = params.courseId;
  const { userInfo } = useUserInfo();
  const { logout } = useUser();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取课程信息和课时列表
  useEffect(() => {
    if (!courseId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [courseInfo, lessonsData] = await Promise.all([
          getCourseInfo(courseId),
          getCourseLessons(courseId)
        ]);
        
        setCourse(courseInfo);
        setLessons(lessonsData.sort((a: Lesson, b: Lesson) => a.order_index - b.order_index));
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId]);

  // 格式化课时类型
  const formatLessonType = (type: string) => {
    const types: { [key: string]: { text: string; color: string; icon: any } } = {
      video: { text: "视频课", color: "bg-blue-100 text-blue-800", icon: Play },
      reading: { text: "阅读", color: "bg-green-100 text-green-800", icon: FileText },
      practice: { text: "实践", color: "bg-purple-100 text-purple-800", icon: BookOpen }
    };
    return types[type] || { text: type, color: "bg-gray-100 text-gray-800", icon: FileText };
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

  // 格式化难度等级
  const formatDifficulty = (level: string) => {
    const levels: { [key: string]: { text: string; color: string } } = {
      beginner: { text: "初级", color: "bg-green-100 text-green-800" },
      intermediate: { text: "中级", color: "bg-yellow-100 text-yellow-800" },
      advanced: { text: "高级", color: "bg-red-100 text-red-800" }
    };
    return levels[level] || { text: level, color: "bg-gray-100 text-gray-800" };
  };

  // 处理Scratch项目打开
  const openScratchProject = (project: string) => {
    if (!project) return;
    
    // 构建Scratch页面URL，使用target=_blank
    const scratchUrl = `/scratch.html?project=${encodeURIComponent(project)}`;
    window.open(scratchUrl, '_blank');
  };

  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
      title={course ? `${course.title} - 课时列表` : "课时列表"}
      subtitle="学习课程中的所有课时"
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
        {/* 课程信息卡片 */}
        {course && (
          <Card className="fun-card border-purple-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl font-bold text-gray-800 mb-2">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600 mb-4">
                    {course.description || "暂无描述"}
                  </CardDescription>
                  <div className="flex items-center gap-4 text-sm">
                    {/* 难度等级 */}
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-2">难度：</span>
                      <Badge className={formatDifficulty(course.difficulty_level).color}>
                        {formatDifficulty(course.difficulty_level).text}
                      </Badge>
                    </div>
                    
                    {/* 总时长 */}
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>总时长：{formatDuration(course.estimated_duration)}</span>
                    </div>
                    
                    {/* 课时数量 */}
                    <div className="flex items-center text-gray-600">
                      <BookOpen className="w-4 h-4 mr-1" />
                      <span>共 {lessons.length} 个课时</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-500">加载课时列表中...</p>
          </div>
        )}

        {/* 课时列表 */}
        {!loading && lessons.length > 0 && (
          <div className="space-y-4">
            {lessons.map((lesson, index) => {
              const lessonType = formatLessonType(lesson.lesson_type);
              const IconComponent = lessonType.icon;
              
              return (
                <Card 
                  key={lesson.id} 
                  className="fun-card hover:shadow-lg transition-all duration-300 border-gray-200"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* 课时序号 */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      
                      {/* 课时信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-bold text-gray-800 mb-1">
                            {lesson.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Badge className={lessonType.color}>
                              <IconComponent className="w-3 h-3 mr-1" />
                              {lessonType.text}
                            </Badge>
                            {lesson.duration > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDuration(lesson.duration)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {lesson.description || "暂无描述"}
                        </p>
                        
                        {/* 操作按钮区域 */}
                        <div className="flex flex-wrap gap-2">
                          {/* 视频链接 */}
                          {lesson.video_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(lesson.video_url, '_blank')}
                              className="rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              观看视频
                              <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                          )}
                          
                          {/* Scratch 项目按钮 */}
                          {lesson.project_1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScratchProject(lesson.project_1)}
                              className="rounded-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300"
                            >
                              <BookOpen className="w-4 h-4 mr-2" />
                              Scratch 项目
                              <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                          )}
                          
                          {/* 额外的项目按钮 */}
                          {lesson.project_2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScratchProject(lesson.project_2)}
                              className="rounded-full hover:bg-green-50 hover:text-green-600 hover:border-green-300"
                            >
                              <BookOpen className="w-4 h-4 mr-2" />
                              扩展项目
                              <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                          )}
                          
                          {lesson.project_3 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScratchProject(lesson.project_3)}
                              className="rounded-full hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
                            >
                              <BookOpen className="w-4 h-4 mr-2" />
                              挑战项目
                              <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 空状态 */}
        {!loading && lessons.length === 0 && (
          <Card className="fun-card text-center py-12">
            <CardContent>
              <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Play className="w-12 h-12 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">这个课程还没有课时</h3>
              <p className="text-gray-600 mb-6">
                请等待老师添加课时内容，或联系老师了解更多信息。
              </p>
              <div className="bg-purple-50 rounded-lg p-4 inline-block">
                <p className="text-sm text-purple-800">
                  💡 提示：老师添加课时后，你就可以开始学习了
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UserLayout>
  );
} 