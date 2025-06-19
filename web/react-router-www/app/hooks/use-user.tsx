import React, { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { fetchWithAuth } from "~/utils/api";
import { HOST_URL } from "~/config";

// 用户信息类型定义
export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  email: string;
  role: string;
}

// 用户上下文类型
interface UserContextType {
  userInfo: UserInfo | null;
  isLoading: boolean;
  error: string | null;
  refreshUserInfo: () => Promise<void>;
  logout: () => void;
}

// 创建用户上下文
const UserContext = createContext<UserContextType | undefined>(undefined);

// 用户提供者组件属性
interface UserProviderProps {
  children: ReactNode;
}

// 获取当前用户信息的API函数
async function getCurrentUserInfo(): Promise<UserInfo> {
  try {
    // 首先尝试从token中解析用户ID
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未找到登录令牌');
    }

    // 解析JWT token获取用户ID (简单解析，不验证签名)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const payload = JSON.parse(jsonPayload);
    const userId = payload.user_id;

    if (!userId) {
      throw new Error('无法从令牌中获取用户ID');
    }

    // 使用用户ID获取完整用户信息
    const response = await fetchWithAuth(`${HOST_URL}/api/user/info`);
    if (!response.ok) {
      throw new Error(`获取用户信息失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("获取用户信息失败:", error);
    throw error;
  }
}

// 用户提供者组件
export function UserProvider({ children }: UserProviderProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取用户信息
  const refreshUserInfo = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUserInfo(null);
      setIsLoading(false);
      setError('未登录');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const info = await getCurrentUserInfo();
      setUserInfo(info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
      setError(errorMessage);
      setUserInfo(null);
      
      // 如果是认证相关错误，清除本地存储
      if (errorMessage.includes('令牌') || errorMessage.includes('401')) {
        localStorage.removeItem('token');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 登出函数
  const logout = () => {
    localStorage.removeItem('token');
    setUserInfo(null);
    setError(null);
    window.location.href = "/";
  };

  // 初始化时获取用户信息
  useEffect(() => {
    refreshUserInfo();
  }, []);

  const contextValue: UserContextType = {
    userInfo,
    isLoading,
    error,
    refreshUserInfo,
    logout,
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

// 使用用户信息的Hook
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// 简化的Hook，只返回用户信息（向后兼容）
export function useUserInfo() {
  const { userInfo, isLoading } = useUser();
  return {
    userInfo: userInfo ? {
      name: userInfo.nickname || userInfo.username,
      role: userInfo.role === 'admin' ? '管理员' : 
            userInfo.role === 'teacher' ? '教师' : '学生'
    } : null,
    isLoading
  };
} 