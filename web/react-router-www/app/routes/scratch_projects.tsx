import * as React from "react"
import { Link } from "react-router"
import { IconPlus } from "@tabler/icons-react"

import { AppSidebar } from "~/components/my-app-sidebar"
import { ProjectTable, type Project } from "~/components/project-table"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api";

// API 服务
import { API_BASE_URL } from "~/config";

// 获取项目列表
async function getScratchProjects() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/scratch/projects`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("获取项目列表失败:", error);
    throw error;
  }
}

// 删除项目
async function deleteScratchProject(id: string) {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/scratch/projects/${id}`, {
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
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 加载数据
  React.useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        const data = await getScratchProjects();
        setProjects(data);
        setError(null);
      } catch (error) {
        console.error("加载数据失败:", error);
        setError("加载项目列表失败");
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // 处理删除项目
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteScratchProject(id);
      // 删除成功后更新列表
      setProjects(projects.filter(project => project.id !== id));
    } catch (error) {
      console.error("删除项目失败:", error);
      throw error;
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Scratch 程序
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Scratch 程序列表</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto mr-4">
            <Button size="sm" asChild>
              <Link to="/scratch">
                <IconPlus className="mr-2 h-4 w-4" />
                新建项目
              </Link>
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md">
              {error}
            </div>
          )}
          
          <ProjectTable 
            projects={projects} 
            isLoading={isLoading} 
            onDeleteProject={handleDeleteProject} 
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
