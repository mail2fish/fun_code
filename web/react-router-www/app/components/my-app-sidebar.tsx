import * as React from "react"
import { ChevronRight, LogOut } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar"
import { HOST_URL } from "~/config"
import { fetchWithAuth } from "~/utils/api"

// This is sample data.
const data = {
  versions: ["0.0.1"],
  navMain: [
    {
      title: "管理菜单",
      url: "#",
      items: [
        // {
        //   title: "班级列表",
        //   url: "/www/classes/list",
        //   isActive: false,
        // },
        // {
        //   title: "创建班级",
        //   url: "/www/classes/create",
        //   isActive: false,
        // },
        {
          title: "用户列表",
          url: "/www/users/list",
          isActive: false,
        },
        {
          title: "创建用户",
          url: "/www/users/create",
          isActive: false,
        },        
      ],
    },
    {
      title: "Scratch程序",
      url: "#",
      items: [
        {
          title: "我的程序列表",
          url: "/www/scratch/projects",
          isActive: false,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    // 调用服务端登出接口
    try {
      await fetchWithAuth(`${HOST_URL}/api/auth/logout`, {
        method: "POST"
      });
    } catch (error) {
      console.error("登出失败:", error);
    }
    localStorage.removeItem('token');
    toast.success("已退出登录");
    navigate("/");
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        FunCode 后台管理
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <Collapsible
            key={item.title}
            title={item.title}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  {item.title}{" "}
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={item.isActive}>
                          <a href={item.url}>{item.title}</a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarRail />
    </Sidebar>
  )
}
