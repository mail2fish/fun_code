import { type ReactNode } from "react";
import { AdminNavbar } from "./admin-navbar";

interface AdminLayoutProps {
  children: ReactNode;
  adminInfo?: {
    name: string;
    role: string;
  };
  onLogout?: () => void;
  title?: string;
  subtitle?: string;
  showBreadcrumb?: boolean;
  breadcrumbItems?: Array<{ label: string; href?: string; }>;
}

export function AdminLayout({ 
  children, 
  adminInfo, 
  onLogout, 
  title, 
  subtitle,
  showBreadcrumb = false,
  breadcrumbItems = []
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 admin-scrollbar">
      {/* Navigation */}
      <AdminNavbar adminInfo={adminInfo} onLogout={onLogout} />
      
      {/* Main Content */}
      <main className="flex-1">
        {/* Page Header */}
        {(title || subtitle || showBreadcrumb) && (
          <div className="bg-white border-b border-gray-200 py-6">
            <div className="container mx-auto px-4">
              {/* Breadcrumb */}
              {showBreadcrumb && breadcrumbItems.length > 0 && (
                <nav className="mb-4">
                  <ol className="flex items-center space-x-2 text-sm text-gray-600">
                    {breadcrumbItems.map((item, index) => (
                      <li key={index} className="flex items-center">
                        {index > 0 && (
                          <svg className="w-4 h-4 mx-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {item.href ? (
                          <a href={item.href} className="hover:text-blue-600 transition-colors duration-200">
                            {item.label}
                          </a>
                        ) : (
                          <span className="text-gray-900 font-medium">{item.label}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              
              {/* Page Title */}
              <div className="flex items-start justify-between">
                <div>
                  {title && (
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-gray-600 max-w-2xl">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Page Content */}
        <div className="container mx-auto px-4 py-6">
          <div className="admin-card p-6 min-h-[70vh]">
            {children}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <span>© 2024 趣编程管理后台</span>
              <span className="text-gray-400">|</span>
              <span>版本 1.0.0</span>
            </div>
            <div className="flex items-center space-x-4">
              <a href="#" className="hover:text-blue-600 transition-colors duration-200">帮助文档</a>
              <span className="text-gray-400">|</span>
              <a href="#" className="hover:text-blue-600 transition-colors duration-200">技术支持</a>
              <span className="text-gray-400">|</span>
              <a href="#" className="hover:text-blue-600 transition-colors duration-200">系统状态</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 