import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { 
  BookOpen, 
  Play,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ExternalLink
} from "lucide-react";

import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 课件接口
interface Lesson {
  id: number;
  created_at: number;
  updated_at: number;
  title: string;
  content: string;
  sort_order: number;
  course_id: number;
  course?: Course;
  document_name: string;
  document_path: string;
  flow_chart_id: number;
  project_type: string;
  project_id_1: number;
  project_id_2: number;
  project_id_3: number;
  video_1: string;
  video_2: string;
  video_3: string;
  duration: number;
  difficulty: string;
  description: string;
}

// 课程数据接口
interface Course {
  id: number;
  title: string;
  description: string;
  author_id: number;
  created_at: number;
  updated_at: number;
  difficulty: string;
  duration: number;
  content: string;
  is_published: boolean;
  sort_order: number;
  thumbnail_path: string;
  author?: {
    id: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    username: string;
    nickname: string;
    email: string;
    role: string;
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

// 获取课程详细信息
async function getCourseInfo(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/courses/${courseId}`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return data.data; // 返回 data 字段中的课程信息
  } catch (error) {
    console.error("获取课程信息失败:", error);
    return null;
  }
}

// 获取课程的课件列表（学生端API）
async function getCourseLessons(courseId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/student/courses/${courseId}/lessons`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error("获取课程课件列表失败:", error);
    return [];
  }
}

export default function ClassCourses() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const classId = params.classId;
  const courseId = searchParams.get('course_id');
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [courseData, setCourseData] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取数据
  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        if (courseId) {
          // 如果有课程ID，获取课程信息和课件列表
          const [classInfo, courseInfo, lessonsData] = await Promise.all([
            getClassInfo(classId),
            getCourseInfo(courseId),
            getCourseLessons(courseId)
          ]);
          
          setClassData(classInfo);
          setCourseData(courseInfo);
          setLessons(lessonsData);
        } else {
          // 如果没有课程ID，获取班级信息和课程列表
          const [classInfo, coursesData] = await Promise.all([
            getClassInfo(classId),
            getClassCourses(classId)
          ]);
          
          setClassData(classInfo);
          setCourses(coursesData);
        }
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, courseId]);

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
      title={courseId && courseData ? `${courseData.title} - 课件列表` : classData?.name ? `${classData.name} - 课程列表` : "课程列表"}
      subtitle={courseId ? "查看课程中的所有课件" : "查看班级中的所有课程"}
    >
      {/* 导航面包屑 */}
      <div className="mb-6 flex items-center space-x-2">
        <Link 
          to="/www/user/my_classes"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回我的班级
        </Link>
        {courseId && (
          <>
            <span className="text-gray-400">/</span>
            <Link 
              to={`/www/user/class_courses/${classId}`}
              className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
            >
              课程列表
            </Link>
          </>
        )}
      </div>

      {/* 主要内容 */}
      <div className="space-y-6">
        {/* 班级信息卡片 */}
        {classData && !courseId && (
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

        {/* 课程信息卡片（显示课件时） */}
        {courseData && courseId && (
          <Card className="fun-card border-purple-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800 mb-2">
                    {courseData.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {courseData.description || "暂无描述"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {formatDifficulty(courseData.difficulty).text}
                  </Badge>
                  <span className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDuration(courseData.duration)}
                  </span>
                </div>
              </div>
              {courseData.author && (
                <div className="flex items-center text-sm text-gray-600 mt-4">
                  <User className="w-4 h-4 mr-2 text-purple-500" />
                  <span>课程作者：{courseData.author.username}</span>
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
        {!loading && !courseId && courses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const difficulty = formatDifficulty(course.difficulty);
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
                          <span>{formatDuration(course.duration)}</span>
                        </div>
                        <Badge className={difficulty.color}>
                          {difficulty.text}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Link 
                        to={`/www/user/class_courses/${classId}?course_id=${course.id}`}
                        className="flex-1"
                      >
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full rounded-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all duration-300"
                        >
                          <BookOpen className="w-4 h-4 mr-2" />
                          查看课件
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

        {/* 课件列表 */}
        {!loading && courseId && lessons.length > 0 && (
          <Card className="fun-card border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-purple-500" />
                课件列表 ({lessons.length} 个课件)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                    <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>课件名称</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="w-24">难度</TableHead>
                    <TableHead className="w-24">时长</TableHead>
                        <TableHead className="w-48 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lessons
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((lesson, index) => (
                    <TableRow key={lesson.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-gray-600">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-800">{lesson.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-600 max-w-xs truncate">
                          {lesson.description || "暂无描述"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {formatDifficulty(lesson.difficulty).text}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDuration(lesson.duration)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {lesson.project_id_1 > 0 ? (
                            <a href={`${HOST_URL}/projects/scratch/lesson/${classId}/${courseId}/${lesson.id}/${lesson.project_id_1}`}>
                              <Button 
                                size="sm" 
                                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white w-24"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                打开程序
                              </Button>
                            </a>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              disabled
                              className="text-gray-400"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              暂无项目
                            </Button>
                          )}
                          {Number(lesson.flow_chart_id as any) > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="w-28"
                              onClick={() => window.open(`/www/excalidraw/open/${lesson.flow_chart_id}`, '_blank')}
                            >
                              查看流程图
                              <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                          )}
                          {!(Number(lesson.flow_chart_id as any) > 0) && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              disabled
                              className="w-28 text-gray-400"
                            >
                              暂无流程图
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 空状态 - 课程列表 */}
        {!loading && !courseId && courses.length === 0 && (
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

        {/* 空状态 - 课件列表 */}
        {!loading && courseId && lessons.length === 0 && (
          <Card className="fun-card text-center py-12">
            <CardContent>
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">这个课程还没有课件</h3>
              <p className="text-gray-600 mb-6">
                请等待老师添加课件，或联系老师了解更多信息。
              </p>
              <div className="bg-blue-50 rounded-lg p-4 inline-block">
                <p className="text-sm text-blue-800">
                  💡 提示：老师添加课件后，你就可以开始学习了
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </UserLayout>
  );
} 