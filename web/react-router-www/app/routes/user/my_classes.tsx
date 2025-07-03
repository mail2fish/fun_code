import { useState, useEffect } from "react";
import { Link } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

import { 
  Users, 
  BookOpen, 
  Clock,
  GraduationCap
} from "lucide-react";

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
  created_at: number;
  updated_at: number;
  teacher?: {
    id: number;
    username: string;
    nickname: string;
    email: string;
    role: string;
  };
  students?: {
    id: number;
    username: string;
    nickname: string;
    email: string;
    role: string;
  }[];
  courses?: {
    id: number;
    title: string;
    description: string;
    difficulty: string;
    duration: number;
    is_published: boolean;
  }[];
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



  // 格式化难度
  const formatDifficulty = (difficulty: string) => {
    const difficultyMap: { [key: string]: string } = {
      'beginner': '初级',
      'intermediate': '中级',
      'advanced': '高级'
    };
    return difficultyMap[difficulty] || difficulty;
  };

  // 格式化时长
  const formatDuration = (duration: number) => {
    if (!duration || duration <= 0) return "未设置";
    
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes > 0 ? `${minutes}分钟` : ''}`;
    } else {
      return `${minutes}分钟`;
    }
  };

  return (
    <UserLayout
      title="我的班级"
      subtitle="查看和管理你加入的班级"
    >
      {/* 主要内容 */}
      <div className="space-y-8">
        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-500">加载班级列表中...</p>
          </div>
        )}

        {/* 班级信息 */}
        {!loading && classes.length > 0 && (
          <div className="space-y-8">
            {classes.map((classItem) => (
              <div key={classItem.id} className="space-y-6">
                {/* 班级头部 */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h1 className="text-3xl font-bold mb-2">班级：{classItem.name}</h1>
                        <p className="text-blue-100 text-lg">{classItem.description || "暂无描述"}</p>
                      </div>
                      <Badge 
                        variant="secondary"
                        className={classItem.is_active ? "bg-green-500 text-white border-green-400" : "bg-gray-500 text-white border-gray-400"}
                      >
                        {classItem.is_active ? "进行中" : "已结束"}
                      </Badge>
                    </div>
                    
                    {/* 教师信息 */}
                    {classItem.teacher && (
                      <div className="flex items-center">
                        <GraduationCap className="w-6 h-6 mr-3" />
                        <div>
                          <p className="text-sm text-blue-100">教师</p>
                          <p className="font-semibold">{classItem.teacher.username}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 背景装饰 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
                </div>

                {/* 统计信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 mb-1">班级同学</p>
                        <p className="text-3xl font-bold text-blue-600">{classItem.students?.length || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-600 mb-1">课程数量</p>
                        <p className="text-3xl font-bold text-purple-600">{classItem.courses?.length || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 课程列表 */}
                {classItem.courses && classItem.courses.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                      <BookOpen className="w-5 h-5 mr-3 text-purple-500" />
                      课程列表
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classItem.courses.map((course) => (
                        <div 
                          key={course.id} 
                          className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 hover:shadow-md transition-all duration-300"
                        >
                          <h4 className="font-semibold text-gray-800 mb-2">{course.title}</h4>
                          {course.description && (
                            <p className="text-gray-600 mb-3 text-sm line-clamp-2">{course.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-xs">
                                {formatDifficulty(course.difficulty)}
                              </Badge>
                              <span className="flex items-center text-xs text-gray-500">
                                <Clock className="w-3 h-3 mr-1" />
                                {formatDuration(course.duration)}
                              </span>
                            </div>
                            <Link to={`/www/user/class_courses/${classItem.id}?course_id=${course.id}`}>
                              <Button 
                                size="sm" 
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                              >
                                查看课件
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!loading && classes.length === 0 && (
          <div className="text-center py-20">
            <div className="w-40 h-40 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Users className="w-20 h-20 text-blue-500" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">还没有加入任何班级</h2>
            <p className="text-gray-600 mb-12 text-xl max-w-md mx-auto">
              向你的老师询问班级邀请码，开始学习之旅吧！
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 max-w-lg mx-auto border border-blue-200">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg">💡</span>
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">如何加入班级？</h3>
                  <p className="text-blue-700">
                    获得班级邀请码后，可以联系管理员将你添加到班级中，然后就可以开始学习啦！
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
} 