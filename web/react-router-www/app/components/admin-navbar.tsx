import { useState } from "react";
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
  Upload
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
  const location = useLocation();

  const navItems = [
    { href: "/www/dashboard", label: "仪表板", icon: LayoutDashboard },
    { href: "/www/admin/users/list", label: "用户管理", icon: Users },
    { href: "/www/admin/scratch/projects", label: "项目管理", icon: FolderOpen },
    { href: "/www/admin/files/list", label: "文件管理", icon: FileText },
    { href: "/www/admin/files/upload", label: "文件上传", icon: Upload },
    { href: "/www/shares/all", label: "分享管理", icon: Shield },
  ];

  const isActive = (path: string) => location.pathname === path;

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