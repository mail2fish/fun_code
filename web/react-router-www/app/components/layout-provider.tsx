import { type ReactNode } from "react";
import { UserLayout } from "./user-layout";
import { AdminLayout } from "./admin-layout";
import { useUserInfo, useUser } from "~/hooks/use-user";

interface LayoutProviderProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBreadcrumb?: boolean;
  breadcrumbItems?: Array<{ label: string; href?: string; }>;
  showBackgroundPattern?: boolean;
  // 强制使用特定布局（可选）
  forceLayout?: "user" | "admin";
}

export function LayoutProvider({ 
  children, 
  title, 
  subtitle,
  showBreadcrumb = false,
  breadcrumbItems = [],
  showBackgroundPattern = true,
  forceLayout
}: LayoutProviderProps) {
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

  // 确定使用哪种布局
  const getLayoutType = () => {
    // 如果强制指定布局，优先使用
    if (forceLayout) return forceLayout;
    
    // 根据用户角色自动判断
    if (!userInfo) return "user"; // 默认用户布局
    
    // 根据登录返回的角色字段进行映射
    switch (userInfo.role) {
      case "admin":
        return "admin";
      case "teacher":
        return "user"; // 教师使用用户布局
      case "student":
        return "user"; // 学生使用用户布局
      default:
        return "user"; // 默认用户布局
    }
  };

  const layoutType = getLayoutType();

  // 渲染对应的布局
  if (layoutType === "admin") {
    return (
      <AdminLayout
        adminInfo={userInfo || undefined}
        onLogout={logout}
        title={title}
        subtitle={subtitle}
        showBreadcrumb={showBreadcrumb}
        breadcrumbItems={breadcrumbItems}
      >
        {children}
      </AdminLayout>
    );
  }

  // 默认使用用户布局
  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
      title={title}
      subtitle={subtitle}
      showBackgroundPattern={showBackgroundPattern}
    >
      {children}
    </UserLayout>
  );
} 