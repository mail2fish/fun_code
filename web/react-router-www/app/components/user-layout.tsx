import { type ReactNode } from "react";
import { UserNavbar } from "./user-navbar";

interface UserLayoutProps {
  children: ReactNode;
  userInfo?: {
    name: string;
    role: string;
  };
  onLogout?: () => void;
  title?: string;
  subtitle?: string;
  showBackgroundPattern?: boolean;
}

export function UserLayout({ 
  children, 
  userInfo, 
  onLogout, 
  title, 
  subtitle,
  showBackgroundPattern = true 
}: UserLayoutProps) {
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
      
      {/* Navigation */}
      <UserNavbar userInfo={userInfo} onLogout={onLogout} />
      
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