# 动态布局选择器使用指南

本系统实现了基于登录返回的 `role` 字段动态选择 `AdminLayout` 或 `UserLayout` 的功能。

## 🏗️ 系统架构

### 核心组件

```
LayoutProvider (智能布局选择器)
├── AdminLayout (管理员专业布局)
└── UserLayout (学生/教师童趣布局)

RoleGuard (角色权限守卫)
├── AdminGuard (仅管理员)
├── TeacherGuard (管理员+教师)
└── StudentGuard (所有角色)
```

### 角色映射规则

```javascript
// 基于后端登录返回的 role 字段
switch (userInfo.role) {
  case "admin":   return "AdminLayout";  // 专业管理界面
  case "teacher": return "UserLayout";   // 童趣教学界面
  case "student": return "UserLayout";   // 童趣学习界面
  default:        return "UserLayout";   // 默认童趣界面
}
```

## 🔄 登录流程集成

### 1. 后端登录响应

```go
// internal/handler/auth.go
type LoginResponse struct {
    Token string `json:"token"`
    Role  string `json:"role"`  // "admin", "teacher", "student"
}
```

### 2. 前端登录处理

```tsx
// components/login-form.tsx
const response = await axios.post(`${HOST_URL}/api/auth/login`, {
  username, password
});

// 保存角色信息到本地存储
localStorage.setItem("token", response.data.data.token);
localStorage.setItem("userRole", response.data.data.role);

// 根据角色跳转到不同页面
const userRole = response.data.data.role;
if (userRole === "admin") {
  navigate("/www/admin/users/list"); // 管理员 → 用户管理
} else {
  navigate("/www/scratch/projects"); // 学生/教师 → 项目页面
}
```

## 🎨 使用方法

### 基础页面布局

```tsx
import { LayoutProvider } from "~/components/layout-provider";

export default function MyPage() {
  return (
    <LayoutProvider
      title="页面标题"
      subtitle="页面副标题"
    >
      {/* 
        页面内容会自动根据用户角色显示在：
        - admin → AdminLayout (专业管理界面)
        - teacher/student → UserLayout (童趣界面)
      */}
      <div>我的页面内容</div>
    </LayoutProvider>
  );
}
```

### 强制指定布局

```tsx
// 强制使用用户布局（即使是管理员）
<LayoutProvider forceLayout="user" title="体验页面">
  <div>此页面总是使用童趣布局</div>
</LayoutProvider>

// 强制使用管理员布局
<LayoutProvider forceLayout="admin" title="系统配置">
  <div>此页面总是使用管理员布局</div>
</LayoutProvider>
```

### 角色权限控制

```tsx
import { AdminGuard, TeacherGuard, RoleGuard } from "~/components/role-guard";

// 仅管理员可访问
export default function AdminPage() {
  return (
    <AdminGuard fallbackPath="/www/dashboard">
      <LayoutProvider title="管理员专用页面">
        <div>只有管理员能看到这里</div>
      </LayoutProvider>
    </AdminGuard>
  );
}

// 教师和管理员可访问
export default function TeacherPage() {
  return (
    <TeacherGuard>
      <LayoutProvider title="教学功能">
        <div>管理员和教师都能访问</div>
      </LayoutProvider>
    </TeacherGuard>
  );
}

// 自定义角色权限
export default function CustomPage() {
  return (
    <RoleGuard allowedRoles={["admin", "teacher"]}>
      <LayoutProvider title="自定义权限页面">
        <div>精确控制访问权限</div>
      </LayoutProvider>
    </RoleGuard>
  );
}
```

## 🎯 布局特性对比

### AdminLayout (管理员布局)
- **设计风格**: 简洁专业、高效布局
- **目标用户**: 系统管理员
- **特色功能**:
  - 面包屑导航
  - 数据表格优化
  - 工作区域最大化
  - 系统状态显示

### UserLayout (童趣布局)
- **设计风格**: 渐变背景、圆角设计、童趣元素
- **目标用户**: 学生、教师
- **特色功能**:
  - 动画背景图案
  - 浮动装饰元素
  - 大号标题渐变色
  - 响应式导航栏

## 🔧 技术实现

### 布局选择逻辑

```tsx
// components/layout-provider.tsx
const getLayoutType = () => {
  // 1. 强制布局优先
  if (forceLayout) return forceLayout;
  
  // 2. 角色自动判断
  if (!userInfo) return "user";
  
  // 3. 角色映射
  switch (userInfo.role) {
    case "admin": return "admin";
    default: return "user";
  }
};
```

### 权限验证流程

```tsx
// components/role-guard.tsx
export function RoleGuard({ children, allowedRoles }) {
  const { userInfo, isLoading } = useUserInfo();
  
  if (isLoading) return <LoadingSpinner />;
  if (!userInfo) return <Navigate to="/login" />;
  
  const hasPermission = allowedRoles.includes(userInfo.role);
  if (!hasPermission) return <Navigate to="/dashboard" />;
  
  return <>{children}</>;
}
```

## 📱 响应式支持

两种布局都完全支持响应式设计：

- **超大屏幕** (xl: 1280px+): 完整功能展示
- **中等屏幕** (md: 768px-1279px): 图标优先设计
- **小屏幕** (<768px): 汉堡菜单折叠

## 🚀 使用示例

### 完整页面示例

```tsx
import { LayoutProvider } from "~/components/layout-provider";
import { AdminGuard } from "~/components/role-guard";

// 管理员专用页面
export default function UserManagePage() {
  return (
    <AdminGuard>
      <LayoutProvider 
        title="用户管理"
        subtitle="管理系统中的所有用户"
        showBreadcrumb={true}
        breadcrumbItems={[
          { label: "首页", href: "/dashboard" },
          { label: "用户管理" }
        ]}
      >
        <UserManagementContent />
      </LayoutProvider>
    </AdminGuard>
  );
}

// 学生项目页面
export default function ProjectsPage() {
  return (
    <LayoutProvider 
      title="我的项目" 
      subtitle="展示你的创意作品"
    >
      <ProjectsContent />
    </LayoutProvider>
  );
}
```

## 🎉 优势特点

- ✅ **无缝切换**: 角色变更时布局立即生效
- ✅ **权限安全**: 自动阻止未授权访问
- ✅ **开发简单**: 统一的API接口
- ✅ **维护方便**: 集中的布局管理
- ✅ **用户体验**: 针对不同角色优化的界面
- ✅ **响应式友好**: 所有设备完美适配

## 🔍 演示页面

访问 `/www/role-demo` 查看完整的角色权限和布局选择演示。 