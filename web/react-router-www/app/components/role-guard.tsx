import { type ReactNode } from "react";
import { Navigate } from "react-router";
import { useUserInfo } from "~/hooks/use-user";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[]; // 允许的角色列表
  fallbackPath?: string; // 权限不足时的跳转路径
  loadingComponent?: ReactNode; // 加载时显示的组件
}

export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallbackPath = "/www/dashboard",
  loadingComponent
}: RoleGuardProps) {
  const { userInfo, isLoading } = useUserInfo();

  // 加载中状态
  if (isLoading) {
    return loadingComponent || (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证权限...</p>
        </div>
      </div>
    );
  }

  // 未登录
  if (!userInfo) {
    return <Navigate to="/login" replace />;
  }

  // 检查角色权限
  const hasPermission = allowedRoles.includes(userInfo.role);

  if (!hasPermission) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

// 预定义的角色常量
export const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher", 
  STUDENT: "student"
} as const;

// 便捷的守卫组件
export function AdminGuard({ children, fallbackPath }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
}

export function TeacherGuard({ children, fallbackPath }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.TEACHER]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
}

export function StudentGuard({ children, fallbackPath }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT]} fallbackPath={fallbackPath}>
      {children}
    </RoleGuard>
  );
} 