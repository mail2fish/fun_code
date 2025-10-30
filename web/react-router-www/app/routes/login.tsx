import { Sparkles, Heart, Star, Rocket } from "lucide-react"

import { LoginForm } from "~/components/login-form"
import { useUserInfo } from "~/hooks/use-user";
import { useNavigate } from "react-router";
import React from "react";

export default function LoginPage() {
  const { userInfo, isLoading } = useUserInfo();
  const navigate = useNavigate();

  // 自动重定向到 dashboard
  React.useEffect(() => {
    if (!isLoading && userInfo) {
      if (userInfo.role === "管理员") {
        navigate("/www/admin/dashboard", { replace: true });
      } else {
        navigate("/www/user/dashboard", { replace: true });
      }
    }
  }, [isLoading, userInfo, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 relative overflow-hidden">
      {/* 背景装饰元素 */}
      <div className="absolute inset-0 overflow-hidden">
        {/* 浮动的装饰图形 */}
        <div className="absolute top-20 left-20 w-16 h-16 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }} />
        <div className="absolute top-40 right-32 w-12 h-12 bg-yellow-300/30 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }} />
        <div className="absolute bottom-40 left-32 w-20 h-20 bg-green-300/20 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '5s' }} />
        <div className="absolute bottom-20 right-20 w-8 h-8 bg-orange-300/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }} />
        
        {/* 星星装饰 */}
        <Star className="absolute top-32 left-1/4 w-6 h-6 text-white/40 animate-pulse" />
        <Star className="absolute bottom-32 right-1/4 w-8 h-8 text-yellow-300/50 animate-pulse" style={{ animationDelay: '1s' }} />
        <Heart className="absolute top-1/2 left-16 w-5 h-5 text-pink-300/40 animate-pulse" style={{ animationDelay: '2s' }} />
        <Rocket className="absolute bottom-1/3 right-16 w-7 h-7 text-blue-300/40 animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        {/* 云朵形状 */}
        <div className="absolute top-16 right-1/3 w-24 h-12 bg-white/15 rounded-full" 
             style={{ 
               borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
               animation: 'float 6s ease-in-out infinite'
             }} />
        <div className="absolute bottom-24 left-1/3 w-32 h-16 bg-white/10 rounded-full"
             style={{ 
               borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
               animation: 'float 8s ease-in-out infinite',
               animationDelay: '3s'
             }} />
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo 区域 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4 group hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-10 h-10 text-purple-600 group-hover:rotate-12 transition-transform duration-300" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              趣编程
            </h1>
            <p className="text-white/90 text-lg font-medium drop-shadow">
              让编程变得有趣 🎉
            </p>
        </div>

          {/* 登录表单卡片 */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white/20">
            <LoginForm />
          </div>

          {/* 底部装饰文字 */}
          <div className="text-center mt-8">
            <p className="text-white/80 text-sm drop-shadow">
              激发孩子的创造力 ✨ 让学习充满乐趣 🌈
            </p>
          </div>
        </div>
      </div>

      {/* 装饰性的渐变叠加 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 pointer-events-none" />
    </div>
  )
}
