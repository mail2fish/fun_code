import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { 
  ChevronLeft,
  FileText,
  Download,
  Image as ImageIcon,
  Music,
  File
} from "lucide-react";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";
import { toast } from "sonner";

// 资源文件接口
interface ResourceFile {
  id: number;
  name: string;
  description: string;
  size: number;
  tag_id: number;
  content_type: number;
  original_name: string;
}

// 课件接口
interface Lesson {
  id: number;
  title: string;
  description: string;
  resource_files?: ResourceFile[];
  resource_file_ids?: number[];
}

// 内容类型常量
const CONTENT_TYPE_IMAGE = 1;
const CONTENT_TYPE_AUDIO = 3;
const CONTENT_TYPE_SPRITE3 = 2;

// 获取课件详情
async function getLesson(lessonId: string): Promise<Lesson | null> {
  try {
    // 使用学生端API获取课件详情（包含资源文件）
    const response = await fetchWithAuth(`${HOST_URL}/api/student/lessons/${lessonId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("课件不存在");
      }
      if (response.status === 403) {
        throw new Error("您没有权限访问该课件");
      }
      throw new Error(`API 错误: ${response.status}`);
    }
    const data = await response.json();
    return data.data || data;
  } catch (error: any) {
    console.error("获取课件详情失败:", error);
    throw error;
  }
}

export default function LessonResourcesPage() {
  const params = useParams();
  const navigate = useNavigate();
  const lessonId = params.lessonId;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) {
      setError("课件ID不存在");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const lessonData = await getLesson(lessonId);
        setLesson(lessonData);
      } catch (err: any) {
        setError(err?.message || "获取课件信息失败");
        toast.error(err?.message || "获取课件信息失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lessonId]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: number) => {
    switch (contentType) {
      case CONTENT_TYPE_IMAGE:
        return <ImageIcon className="h-8 w-8 text-blue-500" />;
      case CONTENT_TYPE_AUDIO:
        return <Music className="h-8 w-8 text-green-500" />;
      case CONTENT_TYPE_SPRITE3:
        return <File className="h-8 w-8 text-purple-500" />;
      default:
        return <FileText className="h-8 w-8 text-gray-500" />;
    }
  };

  const getContentTypeName = (contentType: number) => {
    switch (contentType) {
      case CONTENT_TYPE_IMAGE:
        return "图片";
      case CONTENT_TYPE_AUDIO:
        return "音频";
      case CONTENT_TYPE_SPRITE3:
        return "Scratch角色";
      default:
        return "其他";
    }
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/files/${fileId}/download`);
      if (!response.ok) throw new Error('下载失败');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("文件下载成功");
    } catch (error) {
      toast.error("文件下载失败");
    }
  };

  const resourceFiles = lesson?.resource_files || [];

  return (
    <UserLayout
      title={lesson ? `${lesson.title} - 资源文件` : "课件资源文件"}
      subtitle="查看课件关联的资源文件"
    >
      {/* 导航面包屑 */}
      <div className="mb-6 flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回
        </Button>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <Card className="fun-card border-red-200">
          <CardContent className="py-12 text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-red-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">加载失败</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              返回上一页
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 课件信息和资源文件列表 */}
      {!loading && !error && lesson && (
        <div className="space-y-6">
          {/* 课件信息卡片 */}
          <Card className="fun-card border-purple-200">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800 mb-2">
                {lesson.title}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {lesson.description || "暂无描述"}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* 资源文件列表 */}
          <Card className="fun-card border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-purple-500" />
                资源文件列表 ({resourceFiles.length} 个文件)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resourceFiles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-12 h-12 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">暂无资源文件</h3>
                  <p className="text-gray-600">
                    该课件还没有关联任何资源文件
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {resourceFiles.map((file) => (
                    <Card 
                      key={file.id} 
                      className="flex flex-col h-full rounded-2xl shadow-md border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:border-blue-400 hover:shadow-blue-200/50 hover:bg-gradient-to-br hover:from-blue-50 hover:to-green-50 bg-white border-blue-200"
                    >
                      <div className="w-full h-48 flex items-center justify-center rounded-t-2xl bg-gradient-to-br from-blue-50 to-green-50 relative overflow-hidden transition-all duration-300 hover:from-blue-100 hover:to-green-100">
                        {file.content_type === CONTENT_TYPE_IMAGE || file.content_type === CONTENT_TYPE_SPRITE3 ? (
                          <img
                            src={`${HOST_URL}/api/files/${file.id}/preview`}
                            className="max-h-40 max-w-full object-contain transition-transform duration-300 hover:scale-110"
                            alt={file.description || file.name}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const iconDiv = document.createElement('div');
                                iconDiv.className = 'flex items-center justify-center h-32';
                                parent.appendChild(iconDiv);
                                // 使用 React 渲染图标（这里简化处理）
                                parent.innerHTML = '';
                                parent.appendChild(document.createTextNode(''));
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-32">
                            {getFileIcon(file.content_type)}
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-col gap-2.5 flex-1 p-5">
                        <div className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-1 rounded-lg inline-block w-fit">
                          文件ID：{file.id}
                        </div>
                        {file.description && (
                          <div className="font-bold text-xl text-gray-800 line-clamp-2 leading-tight">
                            {file.description}
                          </div>
                        )}
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <span>📦 {formatFileSize(file.size)}</span>
                          <span className="mx-1">•</span>
                          <span>🏷️ {getContentTypeName(file.content_type)}</span>
                        </div>
                        {file.tag_id && (
                          <Badge variant="outline" className="w-fit">
                            标签: {file.tag_id}
                          </Badge>
                        )}
                        <div className="mt-auto pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 transition-all duration-300"
                            onClick={() => handleDownload(file.id, file.original_name || file.name)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            下载文件
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </UserLayout>
  );
}

