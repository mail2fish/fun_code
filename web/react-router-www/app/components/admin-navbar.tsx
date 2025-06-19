import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";

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
  HardDrive
} from "lucide-react";

interface AdminNavbarProps {
  adminInfo?: {
    name: string;
    role: string;
  };
  onLogout?: () => void;
}

export function AdminNavbar({ adminInfo, onLogout }: AdminNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProgramMenuOpen, setIsProgramMenuOpen] = useState(false);
  const [isResourceMenuOpen, setIsResourceMenuOpen] = useState(false);
  const location = useLocation();
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const programTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resourceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const navItems = [
    { href: "/www/dashboard", label: "首页", icon: LayoutDashboard },
    { href: "/www/shares/all", label: "分享管理", icon: Share2 },
  ];

  const userMenuItems = [
    { href: "/www/admin/users/list", label: "用户列表", icon: UserCheck },
    { href: "/www/admin/users/create", label: "创建用户", icon: UserPlus },
  ];

  const programMenuItems = [
    { href: "/www/admin/scratch/projects", label: "程序列表", icon: FileText },
    { href: `${typeof window !== 'undefined' ? window.location.origin : ''}/projects/scratch/new`, label: "创建程序", icon: Plus, external: true },
  ];

  const resourceMenuItems = [
    { href: "/www/admin/files/list", label: "资源列表", icon: FileText },
    { href: "/www/admin/files/upload", label: "上传资源", icon: Upload },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isUserMenuActive = userMenuItems.some(item => isActive(item.href));
  const isProgramMenuActive = programMenuItems.some(item => isActive(item.href));
  const isResourceMenuActive = resourceMenuItems.some(item => isActive(item.href));

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

  const handleResourceMouseEnter = () => {
    if (resourceTimeoutRef.current) {
      clearTimeout(resourceTimeoutRef.current);
      resourceTimeoutRef.current = null;
    }
    setIsResourceMenuOpen(true);
  };

  const handleResourceMouseLeave = () => {
    if (resourceTimeoutRef.current) {
      clearTimeout(resourceTimeoutRef.current);
    }
    resourceTimeoutRef.current = setTimeout(() => {
      setIsResourceMenuOpen(false);
    }, 150); // 150ms 延迟
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (userTimeoutRef.current) {
        clearTimeout(userTimeoutRef.current);
      }
      if (programTimeoutRef.current) {
        clearTimeout(programTimeoutRef.current);
      }
      if (resourceTimeoutRef.current) {
        clearTimeout(resourceTimeoutRef.current);
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

            {/* Resource Management Dropdown */}
            <div
              className="relative"
              onMouseEnter={handleResourceMouseEnter}
              onMouseLeave={handleResourceMouseLeave}
            >
              <Button
                variant="ghost"
                className={`group flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  isResourceMenuActive || isResourceMenuOpen
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                }`}
              >
                <HardDrive className="h-4 w-4" />
                <span>程序资源</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {/* 自定义下拉菜单 */}
              {isResourceMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {resourceMenuItems.map((item) => {
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
              onClick={onLogout}
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

              {/* Resource Management Section - Mobile */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3 px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-lg">
                  <HardDrive className="h-5 w-5" />
                  <span>程序资源</span>
                </div>
                {resourceMenuItems.map((item) => {
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
                    onLogout?.();
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