import { toast } from "sonner";

// 创建一个自定义的 fetch 函数，自动添加认证信息
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  // 从 localStorage 获取 token
  const token = localStorage.getItem('token');
  
  // 创建新的 headers 对象
  const headers = new Headers(options.headers || {});
  
  // 如果有 token，添加到 headers 中
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // 合并选项
  const newOptions = {
    ...options,
    headers
  };
  
  // 发送请求
  const response = await fetch(url, newOptions);
  
  // 统一处理 401 错误
  if (response.status === 401) {
    // 提示登录失效
    toast.error("登录已失效，请重新登录", {
      duration: 2000,
      position: "top-center"
    });
    // 等待提示显示完成后再跳转
    setTimeout(() => {
      window.location.href = '/?redirect_url=' + encodeURIComponent(window.location.pathname);
    }, 2000);
    return response;
  }
  
  return response;
};