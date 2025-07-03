import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";
import { useUser } from "~/hooks/use-user";

import { 
  LayoutDashboard, 
  Users, 
  FolderOpen, 
  Settings, 
  Shield,
  LogOut,
  Menu,
  X,
  FileText,
  Upload,
  Share2,
  ChevronDown,
  UserPlus,
  UserCheck,
  Plus,
  HardDrive,
  User,
  Globe,
  BookOpen
} from "lucide-react";

interface MenuItemBase {
  href: string;
  label: string;
  icon: any;
}

interface InternalMenuItem extends MenuItemBase {
  external?: false;
}

interface ExternalMenuItem extends MenuItemBase {
  external: true;
}

type MenuItem = InternalMenuItem | ExternalMenuItem;

interface AdminNavbarProps {
  // 移除 adminInfo 和 onLogout props，因为我们直接在组件内获取
}

export function AdminNavbar({}: AdminNavbarProps) {
  // 直接在组件内获取用户信息和logout函数
  const { userInfo, logout } = useUser()
  
  // 格式化用户信息
  const adminInfo = userInfo ? {
    name: userInfo.nickname || userInfo.username,
    role: userInfo.role === 'admin' ? '管理员' : 
          userInfo.role === 'teacher' ? '教师' : '学生'
  } : undefined

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);
  const [isProgramMenuOpen, setIsProgramMenuOpen] = useState(false);
  const [isResourceMenuOpen, setIsResourceMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const location = useLocation();
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const classTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const courseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const programTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resourceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shareTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navItems: MenuItem[] = [
    { href: "/www/admin/dashboard", label: "首页", icon: LayoutDashboard },
  ];

  const userMenuItems: MenuItem[] = [
    { href: "/www/admin/list_users", label: "用户列表", icon: UserCheck },
    { href: "/www/admin/create_user", label: "创建用户", icon: UserPlus },
  ];

  const classMenuItems: MenuItem[] = [
    { href: "/www/admin/list_classes", label: "班级列表", icon: Users },
    { href: "/www/admin/create_class", label: "创建班级", icon: Plus },
  ];

  const courseMenuItems: MenuItem[] = [
    { href: "/www/admin/list_courses", label: "课程列表", icon: FileText },
    { href: "/www/admin/create_course", label: "创建课程", icon: Plus },
    { href: "/www/admin/list_lessons", label: "课件列表", icon: BookOpen },
    { href: "/www/admin/create_lesson", label: "创建课件", icon: Plus },
  ];

  const programMenuItems: MenuItem[] = [
    { href: "/www/admin/all_scratch", label: "全部程序", icon: FileText },
    { href: "/www/shares/all", label: "全部分享", icon: Globe },
    { href: "/www/files/list", label: "资源列表", icon: HardDrive },
    { href: "/www/admin/files/upload", label: "上传资源", icon: Upload },
  ];

  const shareMenuItems: MenuItem[] = [
    { href: `${typeof window !== 'undefined' ? window.location.origin : ''}/projects/scratch/new`, label: "创建程序", icon: Plus, external: true },
    { href: "/www/admin/my_scratch", label: "我的程序", icon: FileText },
    { href: "/www/shares/user", label: "我的分享", icon: User },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isUserMenuActive = userMenuItems.some(item => isActive(item.href));
  const isClassMenuActive = classMenuItems.some(item => isActive(item.href));
  const isCourseMenuActive = courseMenuItems.some(item => isActive(item.href));
  const isProgramMenuActive = programMenuItems.some(item => isActive(item.href));
  const isShareMenuActive = shareMenuItems.some(item => isActive(item.href));

  const handleUserMouseEnter = () => {
    if (userTimeoutRef.current) {
      clearTimeout(userTimeoutRef.current);
      userTimeoutRef.current = null;
    }
    setIsUserMenuOpen(true);
  };

  const handleUserMouseLeave = () => {
    if (userTimeoutRef.current) {
      clearTimeout(userTimeoutRef.current);
    }
    userTimeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  const handleClassMouseEnter = () => {
    if (classTimeoutRef.current) {
      clearTimeout(classTimeoutRef.current);
      classTimeoutRef.current = null;
    }
    setIsClassMenuOpen(true);
  };

  const handleClassMouseLeave = () => {
    if (classTimeoutRef.current) {
      clearTimeout(classTimeoutRef.current);
    }
    classTimeoutRef.current = setTimeout(() => {
      setIsClassMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  const handleCourseMouseEnter = () => {
    if (courseTimeoutRef.current) {
      clearTimeout(courseTimeoutRef.current);
      courseTimeoutRef.current = null;
    }
    setIsCourseMenuOpen(true);
  };

  const handleCourseMouseLeave = () => {
    if (courseTimeoutRef.current) {
      clearTimeout(courseTimeoutRef.current);
    }
    courseTimeoutRef.current = setTimeout(() => {
      setIsCourseMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  const handleProgramMouseEnter = () => {
    if (programTimeoutRef.current) {
      clearTimeout(programTimeoutRef.current);
      programTimeoutRef.current = null;
    }
    setIsProgramMenuOpen(true);
  };

  const handleProgramMouseLeave = () => {
    if (programTimeoutRef.current) {
      clearTimeout(programTimeoutRef.current);
    }
    programTimeoutRef.current = setTimeout(() => {
      setIsProgramMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  const handleShareMouseEnter = () => {
    if (shareTimeoutRef.current) {
      clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = null;
    }
    setIsShareMenuOpen(true);
  };

  const handleShareMouseLeave = () => {
    if (shareTimeoutRef.current) {
      clearTimeout(shareTimeoutRef.current);
    }
    shareTimeoutRef.current = setTimeout(() => {
      setIsShareMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (userTimeoutRef.current) {
        clearTimeout(userTimeoutRef.current);
      }
      if (classTimeoutRef.current) {
        clearTimeout(classTimeoutRef.current);
      }
      if (courseTimeoutRef.current) {
        clearTimeout(courseTimeoutRef.current);
      }
      if (programTimeoutRef.current) {
        clearTimeout(programTimeoutRef.current);
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm admin-scrollbar">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/www/dashboard" className="flex items-center space-x-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white group-hover:bg-blue-700 transition-colors duration-200">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900">趣编程</span>
              <span className="text-xs text-blue-600 font-medium">管理后台</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Share Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleShareMouseEnter}
              onMouseLeave={handleShareMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isShareMenuActive || isShareMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <Share2 className="h-4 w-4" />
                <span>我的程序</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isShareMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {shareMenuItems.map((item) => {
                    const Icon = item.icon;
                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 text-gray-700"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive(item.href) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Program Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleProgramMouseEnter}
              onMouseLeave={handleProgramMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isProgramMenuActive || isProgramMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                <span>程序管理</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isProgramMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {programMenuItems.map((item) => {
                    const Icon = item.icon;
                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 text-gray-700"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </a>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive(item.href) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleUserMouseEnter}
              onMouseLeave={handleUserMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isUserMenuActive || isUserMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>用户管理</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isUserMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {userMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive(item.href) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Class Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleClassMouseEnter}
              onMouseLeave={handleClassMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isClassMenuActive || isClassMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>班级管理</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isClassMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {classMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive(item.href) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Course Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleCourseMouseEnter}
              onMouseLeave={handleCourseMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isCourseMenuActive || isCourseMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>课程管理</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isCourseMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {courseMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center space-x-2 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ${
                          isActive(item.href) ? "bg-blue-50 text-blue-600" : "text-gray-700"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex md:items-center md:space-x-3">
            {adminInfo && (
              <div className="flex items-center space-x-3 rounded-lg bg-gray-50 px-3 py-2">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {adminInfo.name.charAt(0)}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{adminInfo.name}</div>
                  <div className="text-xs text-gray-500">{adminInfo.role}</div>
                </div>
              </div>
            )}
            <Button
              onClick={() => {
                console.log("Logout button clicked, onLogout:", logout);
                logout();
              }}
              variant="outline"
              size="sm"
              className="rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden rounded-lg"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center space-x-3 rounded-lg px-3 py-3 text-base font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              {/* Program Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <FolderOpen className="h-5 w-5" />
                  <span>程序管理</span>
                </div>
                {programMenuItems.map((item) => {
                  const Icon = item.icon;
                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Share Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <Share2 className="h-5 w-5" />
                  <span>我的程序</span>
                </div>
                {shareMenuItems.map((item) => {
                  const Icon = item.icon;
                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Class Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <Users className="h-5 w-5" />
                  <span>班级管理</span>
                </div>
                {classMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Course Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <BookOpen className="h-5 w-5" />
                  <span>课程管理</span>
                </div>
                {courseMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* User Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <Users className="h-5 w-5" />
                  <span>用户管理</span>
                </div>
                {userMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center space-x-3 rounded-lg px-6 py-2 text-sm font-medium transition-colors duration-200 ${
                        isActive(item.href)
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              {/* Mobile User Info & Logout */}
              <div className="border-t pt-4 mt-4">
                {adminInfo && (
                  <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-50 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-medium">
                      {adminInfo.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{adminInfo.name}</div>
                      <div className="text-xs text-gray-500">{adminInfo.role}</div>
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => {
                    console.log("Mobile logout button clicked, onLogout:", logout);
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 