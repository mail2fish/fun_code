import * as React from "react"
import { Link } from "react-router"
import { IconPlus } from "@tabler/icons-react"

import { AppSidebar } from "~/components/my-app-sidebar"
import { ProjectTable } from "~/components/project-table"
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
import { HOST_URL } from "~/config";

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

export default function Page() {
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
            <Button 
              size="sm" 
              asChild
              disabled={isButtonCooling}
            >
              <a 
                href={`${HOST_URL}/projects/scratch/new`} 
                onClick={handleNewProjectClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "新建Scratch程序"}
              </a>
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
            onDeleteProject={handleDeleteProject}
            projectsApiUrl={`${HOST_URL}/api/scratch/projects`}
            showUserFilter={true}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
