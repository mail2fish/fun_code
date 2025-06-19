import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "./ui/button";
import { 
  Home, 
  Blocks, 
  Users, 
  Share2, 
  FileText, 
  Globe,
  LogOut,
  Menu,
  X,
  Sparkles
} from "lucide-react";

interface UserNavbarProps {
  userInfo?: {
    name: string;
    role: string;
  };
  onLogout?: () => void;
}

export function UserNavbar({ userInfo, onLogout }: UserNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { href: "/www/dashboard", label: "首页", icon: Home },
    { href: "/www/scratch/projects", label: "我的程序", icon: Blocks },
    { href: "/www/classes/list", label: "我的班级", icon: Users },
    { href: "/www/shares/user", label: "我的分享", icon: Share2 },
    { href: "/www/shares/all", label: "全部分享", icon: Globe },
    { href: "/www/files/list", label: "资源文件", icon: FileText },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/www/dashboard" className="flex items-center space-x-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white group-hover:scale-110 transition-transform duration-300">
              <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform duration-300" />
            </div>
            {/* 完整文字 - 大屏幕 */}
            <span className="hidden sm:block text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              趣编程
            </span>
            {/* 简化文字 - 小屏幕 */}
            <span className="sm:hidden text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              趣
            </span>
          </Link>

          {/* Adaptive Navigation */}
          <div className="hidden md:flex md:items-center">
            {/* 大屏幕：完整导航 */}
            <div className="hidden xl:flex xl:items-center xl:space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`group flex items-center space-x-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 hover:scale-105 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "text-gray-600 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 hover:text-purple-600"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive(item.href) ? "animate-bounce" : "group-hover:rotate-12"} transition-transform duration-300`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* 中等屏幕：图标优先，hover显示标签 */}
            <div className="hidden md:flex xl:hidden md:items-center md:space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`group relative flex items-center justify-center rounded-full p-3 transition-all duration-300 hover:scale-110 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                        : "text-gray-600 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 hover:text-purple-600"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive(item.href) ? "animate-bounce" : "group-hover:rotate-12"} transition-transform duration-300`} />
                    
                    {/* Tooltip */}
                    <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.label}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="hidden md:flex md:items-center">
            {/* 大屏幕：完整用户信息 */}
            <div className="hidden xl:flex xl:items-center xl:space-x-4">
              {userInfo && (
                <div className="flex items-center space-x-2 rounded-full bg-gradient-to-r from-blue-100 to-green-100 px-4 py-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center text-white text-sm font-medium">
                    {userInfo.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{userInfo.name}</span>
                </div>
              )}
              <Button
                onClick={onLogout}
                variant="outline"
                size="sm"
                className="rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-300"
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出
              </Button>
            </div>

            {/* 中等屏幕：紧凑模式 */}
            <div className="hidden md:flex xl:hidden md:items-center md:space-x-2">
              {userInfo && (
                <div className="group relative">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center text-white font-medium cursor-pointer hover:scale-110 transition-transform duration-300">
                    {userInfo.name.charAt(0)}
                  </div>
                  {/* User Tooltip */}
                  <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {userInfo.name} ({userInfo.role})
                    <div className="absolute bottom-full right-4 border-4 border-transparent border-b-gray-900"></div>
                  </div>
                </div>
              )}
              <Button
                onClick={onLogout}
                variant="outline"
                size="sm"
                className="rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-300 p-2"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden rounded-full"
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
          <div className="md:hidden border-t bg-white/95 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center space-x-3 rounded-xl px-3 py-3 text-base font-medium transition-all duration-300 ${
                      isActive(item.href)
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : "text-gray-600 hover:bg-gradient-to-r hover:from-purple-100 hover:to-pink-100 hover:text-purple-600"
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
                {userInfo && (
                  <div className="flex items-center space-x-3 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-100 to-green-100 mb-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center text-white font-medium">
                      {userInfo.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">{userInfo.name}</div>
                      <div className="text-xs text-gray-500">{userInfo.role}</div>
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => {
                    onLogout?.();
                    setIsMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-300"
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