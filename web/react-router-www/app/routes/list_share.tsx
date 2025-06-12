import * as React from "react"
import { Link } from "react-router"
import { IconShare } from "@tabler/icons-react"

import { AppSidebar } from "~/components/my-app-sidebar"
import { ShareTable } from "~/components/share-table"
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

// API 服务
import { HOST_URL } from "~/config";

export default function Page() {
  const [error, setError] = React.useState<string | null>(null);

  const handleDeleteShare = async (id: string) => {
    try {
      const response = await fetch(`${HOST_URL}/api/shares/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('删除分享失败');
      }
    } catch (error) {
      console.error('删除分享失败:', error);
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
                    我的分享
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>分享列表</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto mr-4">
            <Button 
              size="sm" 
              asChild
            >
              <Link 
                to="/www/scratch/projects" 
              >
                <IconShare className="mr-2 h-4 w-4" />
                去创建分享
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
          <ShareTable 
            sharesApiUrl={`${HOST_URL}/api/shares/list`}
            onDeleteShare={handleDeleteShare}
            showDeleteButton={true}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 