import { useState, useEffect } from "react";
import { Link } from "react-router";
import { LayoutProvider } from "~/components/layout-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { 
  Blocks, 
  Users, 
  Share2, 
  FileText, 
  PlusCircle, 
  Clock,
  Star,
  Zap,
  Trophy,
  Rocket
} from "lucide-react";
import { useUserInfo, useUser } from "~/hooks/use-user";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 模拟统计数据
const mockStats = {
  projects: 8,
  classes: 3,
  shares: 5,
  files: 12
};

// 项目接口定义
interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at?: string;
  createdAt?: string;
}

export default function Dashboard() {
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();
  
  // 最近项目状态
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // 获取最近项目
  useEffect(() => {
    const fetchRecentProjects = async () => {
      try {
        setLoadingProjects(true);
        const params = new URLSearchParams();
        params.append("pageSize", "8");
        params.append("forward", "true");
        params.append("asc", "false"); // 最新的在前
        
        const res = await fetchWithAuth(`${HOST_URL}/api/scratch/projects?${params.toString()}`);
        const resp = await res.json();
        
        // 兼容不同接口返回结构
        let projects: Project[] = [];
        if (Array.isArray(resp.data)) {
          projects = resp.data;
        } else if (Array.isArray(resp.data?.projects)) {
          projects = resp.data.projects;
        }
        
        setRecentProjects(projects.slice(0, 4)); // 只取前4个项目
      } catch (error) {
        console.error("获取最近项目失败:", error);
        setRecentProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchRecentProjects();
  }, []);

  // 格式化日期函数
  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知时间";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "未知时间";
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) return "刚刚";
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
      return date.toLocaleDateString("zh-CN");
    } catch (error) {
      return "未知时间";
    }
  };

  return (
    <LayoutProvider
      title={userInfo ? `欢迎回来，${userInfo.name}！` : "欢迎回来！"}
      subtitle="今天想创造什么有趣的项目呢？"
    >
      {/* 快速操作区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link to="/www/admin/my_scratch">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Blocks className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的程序</h3>
              <p className="text-gray-600 text-sm mb-3">创建和管理你的Scratch程序</p>
              {/* <div className="text-2xl font-bold text-purple-600">{mockStats.projects}</div> */}
            </CardContent>
          </Card>
        </Link>

        <Link to="/www/shares/user">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-green-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的分享</h3>
              <p className="text-gray-600 text-sm mb-3">管理你分享的作品</p>
              {/* <div className="text-2xl font-bold text-green-600">{mockStats.shares}</div> */}
            </CardContent>
          </Card>
        </Link>

        <Link to="/www/shares/all">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">全部分享</h3>
              <p className="text-gray-600 text-sm mb-3">浏览所有用户的分享作品</p>
              {/* <div className="text-2xl font-bold text-blue-600">{mockStats.shares}</div> */}
            </CardContent>
          </Card>
        </Link>


        <Link to="/www/files/list">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-orange-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">资源文件</h3>
              <p className="text-gray-600 text-sm mb-3">查看资源文件</p>
              {/* <div className="text-2xl font-bold text-orange-600">{mockStats.files}</div> */}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 主要内容区域 */}
      <div className="mt-8">
        {/* 最近项目 */}
        <Card className="fun-card border-purple-200 max-w-5xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <CardTitle className="text-xl text-gray-800">最近项目</CardTitle>
                </div>
                <Link to="/www/scratch/projects">
                  <Button variant="outline" size="sm" className="rounded-full">
                    查看全部
                  </Button>
                </Link>
              </div>
              <CardDescription>继续你未完成的创作吧！</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  加载最近项目中...
                </div>
              ) : recentProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {recentProjects.map((project: Project) => (
                    <div key={project.id} className="group">
                      <a href={`${HOST_URL}/projects/scratch/open/${project.id}`} className="block">
                        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-2xl hover:border-purple-200 transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]">
                          {/* 项目缩略图 */}
                          <div className="relative aspect-video bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
                            <img
                              src={`${HOST_URL}/api/scratch/projects/${project.id}/thumbnail`}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              alt="项目缩略图"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="w-full h-full flex items-center justify-center">
                                      <div class="text-center">
                                        <div class="text-6xl mb-2 opacity-60">🎮</div>
                                        <div class="text-sm text-gray-400 font-medium">Scratch项目</div>
                                      </div>
                                    </div>
                                  `;
                                }
                              }}
                            />
                            {/* 渐变遮罩 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                          
                          {/* 项目信息 */}
                          <div className="p-6">
                            <div className="mb-3">
                              <h3 className="font-bold text-xl text-gray-900 group-hover:text-purple-600 transition-colors duration-300 line-clamp-2 leading-tight mb-2">
                                {project.name || "未命名项目"}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                  <span>{formatDate(project.created_at || project.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* 底部标签 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  🎯 ID: {project.id}
                                </span>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <span className="text-5xl">🎨</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">开始你的创作之旅</h3>
                    <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                      还没有项目呢！创建你的第一个Scratch项目，让想象力自由飞翔吧！
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <Button className="w-full fun-button-primary" asChild>
                  <a href={`${HOST_URL}/projects/scratch/new`}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    创建新项目
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
      </div>
    </LayoutProvider>
  );
}
