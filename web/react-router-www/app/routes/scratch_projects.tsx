import * as React from "react"
import { Link } from "react-router"
import { IconPlus } from "@tabler/icons-react"

import { AppSidebar } from "~/components/my-app-sidebar"
import { ProjectTable, type ProjectsData } from "~/components/project-table"
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

// 获取项目列表
async function getScratchProjects(beginID = "0",pageSize = 10,forward = false,asc=false) {
  try {
    const params = new URLSearchParams();
    params.append('pageSize', pageSize.toString());
    params.append('asc', asc.toString());
    params.append('forward', forward.toString());
    if (beginID != "0") {
      params.append('beginID', beginID.toString());
    }
    
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects?${params.toString()}`);
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
const defaultPageSize = 10; // 每页显示的项目数量

export default function Page() {
  const [projectsData, setProjectsData] = React.useState<ProjectsData>({
    projects: [],
    users: [],
    total: 0,
    showForward: false,
    showBackward: false,
    currentPage: 1,
    pageSize: defaultPageSize
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // 添加按钮冷却状态
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);



  // 加载数据
  const fetchProjects = async (beginID = "0", forard=false,asc=false ) => {
    try {
      let page = projectsData.currentPage;
      if (beginID == "0") {
        page = 0 ;
      }

      let pageSize=defaultPageSize;
      let showForward = false;
      let showBackward = false;


      setIsLoading(true);
      const response = await getScratchProjects(beginID, pageSize,forard,asc);

      // 如果向后翻页
      if (forard) {        
        page++;
        if (response.hasMore) {
          showForward = true;
        }
        if (page > 1) {
          showBackward = true;
        }
        // 如果向前翻页
      } else {
        page--;
        if (page > 1) {
          showBackward = true;
        }
        // 只有在有更多数据或不是第一页时才显示向前按钮
        showForward = response.hasMore || page > 0;
      }

      setProjectsData({
        projects: response.data || [],
        users: response.users || [],  
        total: response.total || 0,
        showForward: showForward,
        showBackward: showBackward,
        currentPage: page,
        pageSize: defaultPageSize
    
      });
      setError(null);
    } catch (error) {
      console.error("加载数据失败:", error);
      setError("加载项目列表失败");
      setProjectsData({
        projects:  [],
        users: [],
        total:  0,
        showForward: false,
        showBackward: false,
        currentPage: 1,
        pageSize: defaultPageSize
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 初始加载
  const isFirstRender = React.useRef(true);
  
  React.useEffect(() => {
    if (isFirstRender.current) {
      fetchProjects("0", true, false);
      console.log("useEffect");
      isFirstRender.current = false;
    }
  }, []);

  // 处理页码变化
  const handlePageChange = (beginID: string,forward:boolean,asc:boolean) => {
    console.log("handlePageChange",beginID,forward,asc);
    fetchProjects(beginID,forward,asc);
  };


  // 处理删除项目
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteScratchProject(id);
      // 删除成功后重新加载当前页
      console.log("删除成功后重新加载当前页");
       fetchProjects("0", false,false);
    } catch (error) {
      console.error("删除项目失败:", error);
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
    }, 2000); // 2秒冷却时间
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
              <Link 
                to={`${HOST_URL}/projects/scratch/new`} 
                target="_blank"
                onClick={handleNewProjectClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "新建Scratch程序"}
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
            projectsData={projectsData} 
            isLoading={isLoading} 
            onDeleteProject={handleDeleteProject}
            onPageChange={handlePageChange}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
