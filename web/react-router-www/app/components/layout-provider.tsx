import { type ReactNode } from "react";
import { UserLayout } from "./user-layout";
import { AdminLayout } from "./admin-layout";
import { useUser } from "~/hooks/use-user";

interface LayoutProviderProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showBreadcrumb?: boolean;
  breadcrumbItems?: Array<{ label: string; href?: string; }>;
  showBackgroundPattern?: boolean;
  showNavigation?: boolean;
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
  showNavigation = true,
  forceLayout
}: LayoutProviderProps) {
  const { userInfo, logout } = useUser();

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

  // 转换用户信息格式以适配布局组件
  const getFormattedUserInfo = () => {
    if (!userInfo) return undefined;
    return {
      name: userInfo.nickname || userInfo.username,
      role: userInfo.role === 'admin' ? '管理员' : 
            userInfo.role === 'teacher' ? '教师' : '学生'
    };
  };

  const formattedUserInfo = getFormattedUserInfo();

  // 如果不显示导航栏，使用类似UserLayout的样式但不显示导航条
  if (!showNavigation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        {/* Background Pattern */}
        {showBackgroundPattern && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full opacity-10">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <defs>
                  <pattern id="fun-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="10" cy="10" r="2" fill="url(#gradient1)" />
                    <polygon points="5,5 15,5 10,15" fill="url(#gradient2)" opacity="0.5" />
                  </pattern>
                  <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
                <rect width="100" height="100" fill="url(#fun-pattern)" />
              </svg>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }} />
            <div className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-pink-300 to-purple-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }} />
            <div className="absolute bottom-40 left-20 w-10 h-10 bg-gradient-to-r from-blue-300 to-green-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '2s', animationDuration: '5s' }} />
            <div className="absolute bottom-20 right-10 w-4 h-4 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }} />
          </div>
        )}
        
        {/* Logo Only (no navigation) */}
        <div className="relative pt-6">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-2">
                <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">趣</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">趣编程</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <main className="relative">
          {/* Page Header */}
          {(title || subtitle) && (
            <div className="container mx-auto px-4 py-8">
              <div className="text-center mb-8">
                {title && (
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4 bounce-in">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Page Content */}
          <div className="container mx-auto px-4 pb-16">
            <div className="fun-card p-6 md:p-8 min-h-[60vh]">
              {children}
            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="relative mt-auto py-8 bg-white/50 backdrop-blur-sm border-t border-white/20">
          <div className="container mx-auto px-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">趣</span>
                </div>
                <span className="text-gray-600 font-medium">让编程变得有趣</span>
              </div>
              <p className="text-sm text-gray-500">
                © 2024 趣编程. 激发孩子的创造力，让学习充满乐趣
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // 渲染对应的布局
  if (layoutType === "admin") {
    return (
      <AdminLayout
        adminInfo={formattedUserInfo}
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
      userInfo={formattedUserInfo}
      onLogout={logout}
      title={title}
      subtitle={subtitle}
      showBackgroundPattern={showBackgroundPattern}
    >
      {children}
    </UserLayout>
  );
} 