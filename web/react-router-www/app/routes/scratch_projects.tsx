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

// 导入用户信息管理
import { useUserInfo, useUser } from "~/hooks/use-user";

// 删除程序
async function deleteScratchProject(id: string) {
  console.log("删除程序",id);
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除程序失败:", error);
    throw error;
  }
}

export default function ScratchProjectsPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

  // 处理删除程序
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteScratchProject(id);
      // 删除成功后重新加载当前页
      console.log("删除成功后重新加载当前页");
    } catch (error) {
      setError("删除程序失败");
      throw error;
    }
  };

  // 处理新建程序按钮点击
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

  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
    >
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 程序列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Rocket className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">程序列表</CardTitle>
                <CardDescription>查看和管理你的所有Scratch程序</CardDescription>
              </div>
            </div>
            
            {/* 新建程序按钮 */}
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
                {isButtonCooling ? "创建中..." : "新建程序"}
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
