import * as React from "react"
import { Link } from "react-router"
import { IconPlus } from "@tabler/icons-react"
import { Toaster } from "sonner"

import { AdminLayout } from "~/components/admin-layout"
import { ProjectTable } from "~/components/project-table"
import { Button } from "~/components/ui/button"
import { useUser } from "~/hooks/use-user"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api";

// API 服务
import { HOST_URL } from "~/config";

// 删除项目
async function deleteScratchProject(id: string) {
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

export default function Page() {
  const [error, setError] = React.useState<string | null>(null);
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);
  const { userInfo, logout } = useUser();

  // 处理删除项目
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteScratchProject(id);
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

  const adminInfo = userInfo ? {
    name: userInfo.nickname || userInfo.username,
    role: userInfo.role === 'admin' ? '管理员' : 
          userInfo.role === 'teacher' ? '教师' : '学生'
  } : undefined;

  return (
    <AdminLayout
      adminInfo={adminInfo}
      onLogout={logout}
      title="Scratch 程序管理"
      subtitle="管理系统中的所有 Scratch 编程项目"
      showBreadcrumb={true}
      breadcrumbItems={[
        { label: "程序管理" },
        { label: "Scratch 程序列表" }
      ]}
    >
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
      
      {/* 操作栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}
        </div>
        
        <Button 
          asChild
          disabled={isButtonCooling}
          className="bg-green-600 hover:bg-green-700"
        >
          <Link 
            to={`${HOST_URL}/projects/scratch/new`} 
            target="_blank"
            onClick={handleNewProjectClick}
            className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            {isButtonCooling ? "请稍候..." : "新建项目"}
          </Link>
        </Button>
      </div>

      {/* 项目表格 */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <ProjectTable 
          onDeleteProject={handleDeleteProject}
          projectsApiUrl={`${HOST_URL}/api/admin/scratch/projects`}
          showUserFilter={true}
        />
      </div>
    </AdminLayout>
  )
}
