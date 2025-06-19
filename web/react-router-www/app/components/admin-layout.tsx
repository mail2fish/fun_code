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
  onLogout
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <AdminNavbar adminInfo={adminInfo} onLogout={onLogout} />
      
      {/* Main Content */}
      <main className="flex-1">        
        {/* Page Content - Direct without header */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden min-h-[calc(100vh-200px)]">
            <div className="p-8">
              {children}
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer - Minimal */}
      <footer className="bg-white border-t border-gray-200 py-3 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>© 2024 趣编程管理后台</span>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              <span>系统正常</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 