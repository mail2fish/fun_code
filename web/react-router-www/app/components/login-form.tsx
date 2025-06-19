import { useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { useUser, setTokenAndRefresh } from "~/hooks/use-user";

import { HOST_URL } from "~/config";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUserInfo } = useUser();

  const { username, password } = formData;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username || !password) {
      setError("请填写所有字段");
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${HOST_URL}/api/auth/login`, {
        username,
        password,
      });

      // 保存token并触发用户信息刷新
      setTokenAndRefresh(response.data.data.token);
      
      // 保存角色信息，用于布局选择
      if (response.data.data.role) {
        localStorage.setItem("userRole", response.data.data.role);
      }

      // 等待用户信息加载完成
      await refreshUserInfo();

      // 根据角色跳转到不同页面
      const userRole = response.data.data.role;
      if (userRole === "admin") {
        navigate("/www/dashboard"); // 管理员跳转到用户管理
      } else {
        navigate("/www/dashboard"); // 学生/教师跳转到项目页面
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "登录失败，请检查用户名和密码");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form 
      className={cn("flex flex-col gap-6", className)} 
      {...props}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          欢迎回来！
        </h1>
        <p className="text-gray-600 text-sm">
          准备好开始你的编程冒险了吗？🚀
        </p>
      </div>
      <div className="grid gap-5">
        <div className="grid gap-3">
          <Label htmlFor="username" className="text-gray-700 font-medium flex items-center gap-2">
            👤 用户名
          </Label>
          <Input 
            id="username" 
            name="username"
            placeholder="输入你的用户名" 
            required 
            value={username}
            onChange={onChange}
            className="rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:ring-purple-300 px-4 py-3 transition-all duration-300"
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-2">
            🔒 密码
          </Label>
          <Input 
            id="password" 
            name="password"
            type="password" 
            placeholder="输入你的密码"
            required 
            value={password}
            onChange={onChange}
            className="rounded-2xl border-2 border-purple-200 focus:border-purple-400 focus:ring-purple-300 px-4 py-3 transition-all duration-300"
          />
        </div>
        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-2xl border border-red-200">
            ❌ {error}
          </div>
        )}
        <Button 
          type="submit" 
          className="w-full fun-button-primary text-lg py-3 mt-2" 
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              登录中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              🎯 开始探索
            </span>
          )}
        </Button>
      </div>
      <div className="text-center text-sm text-gray-500 mt-4">
        <div className="flex items-center justify-center gap-2">
          <span>还没有账户？</span>
          <span className="text-purple-600 font-medium">联系老师创建账户</span>
          <span>📧</span>
        </div>
      </div>
    </form>
  )
}
