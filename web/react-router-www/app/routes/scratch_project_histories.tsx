import * as React from "react"
import { Link } from "react-router"
import { AppSidebar } from "~/components/my-app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useParams } from "react-router"    
// 假设有 ProjectHistoryTable 组件用于展示历史记录
// 你需要根据实际情况实现或调整该组件
import { ProjectHistoryTable, type ProjectHistoriesData } from "~/components/project-history-table"
import { Button } from "~/components/ui/button"
import { IconChevronLeft } from "@tabler/icons-react"

// 获取项目历史记录列表
async function getScratchProjectHistories(projectId: string) {
  try {
 
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects/${projectId}/histories`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("获取项目历史记录失败:", error);
    throw error;
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return "未知时间";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "未知时间";
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  } catch {
    return "时间格式错误";
  }
}

export default function ScratchProjectHistories() {
  const [historiesData, setHistoriesData] = React.useState<ProjectHistoriesData>({
    project_id: "",
    name: "",
    histories: [],
    updated_at: "",
    created_at: "",
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { projectId } = useParams();

  React.useEffect(() => {
    if (projectId) {
      getScratchProjectHistories(projectId)
        .then(response => {
            setHistoriesData({
            project_id: response.data.project_id,
            name: response.data.name,
            histories: response.data.histories || [],
            updated_at: response.data.updated_at,
            created_at: response.data.created_at,
          });
          setError(null);
        })
        .catch(() => setError("加载项目历史记录失败"))
        .finally(() => setIsLoading(false));
    }
  }, [projectId]);

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
                  <BreadcrumbPage>Scratch 项目历史记录</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
      <Separator className="my-4" />

      <div className="flex flex-col gap-4 px-4 py-2 bg-muted/30 rounded-lg mb-4">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-24">项目缩略图</span>
          <div className="h-20 w-20 overflow-hidden rounded-md border">
            {projectId && (
              <img 
                src={`${HOST_URL}/api/scratch/projects/${projectId}/thumbnail`} 
                alt="项目缩略图" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/images/scratch-default-thumbnail.png";
                }}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-24">项目ID</span>
          <span >{historiesData.project_id}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-24">项目名称</span>
          <span>{historiesData.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-24">创建时间</span>
          <span>{formatDate(historiesData.created_at)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-24">更新时间</span>
          <span>{formatDate(historiesData.updated_at)}</span>
        </div>
      </div>
      <div className="flex justify-center">
            <button 
              onClick={() => window.history.back()} 
              className="text-blue-500 hover:text-blue-600"
            >  
                返回列表
            </button>
        </div>
       <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
         {error && (
           <div className="bg-destructive/10 text-destructive p-3 rounded-md">
             {error}
           </div>
         )}
         <ProjectHistoryTable
           historiesData={historiesData}
           isLoading={isLoading}
         />
       </div>

      </SidebarInset>
    </SidebarProvider>
  );
} 