import * as React from "react"
import { Plus, Sparkles, Rocket } from "lucide-react"
import { Toaster } from "sonner"

import { UserLayout } from "~/components/user-layout"
import { ProjectTable } from "~/components/project-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api";

// API 服务
import { HOST_URL } from "~/config";

// 模拟用户数据
const mockUserInfo = {
  name: "小明",
  role: "学生"
};

// 删除项目
async function deleteScratchProject(id: string) {
  console.log("删除项目",id);
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除项目失败:", error);
    throw error;
  }
}

export default function ScratchProjectsPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);

  // 处理删除项目
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteScratchProject(id);
      // 删除成功后重新加载当前页
      console.log("删除成功后重新加载当前页");
    } catch (error) {
      setError("删除项目失败");
      throw error;
    }
  };

  // 处理新建项目按钮点击
  const handleNewProjectClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault();
      return;
    }
    setIsButtonCooling(true);
    setTimeout(() => {
      setIsButtonCooling(false);
    }, 2000);
  };

  // 处理用户登出
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <UserLayout
      userInfo={mockUserInfo}
      onLogout={handleLogout}
    >
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 项目列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Rocket className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">项目列表</CardTitle>
                <CardDescription>查看和管理你的所有Scratch项目</CardDescription>
              </div>
            </div>
            
            {/* 新建项目按钮 */}
            <Button 
              size="lg"
              disabled={isButtonCooling}
              asChild
              className="fun-button-primary"
            >
              <a 
                href={`${HOST_URL}/projects/scratch/new`} 
                onClick={handleNewProjectClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <Plus className="mr-2 h-5 w-5" />
                {isButtonCooling ? "创建中..." : "新建项目"}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectTable 
            onDeleteProject={handleDeleteProject}
            projectsApiUrl={`${HOST_URL}/api/scratch/projects`}
            showUserFilter={false}
          />
        </CardContent>
      </Card>

      {/* Toast 通知 */}
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
    </UserLayout>
  )
}
