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

// 格式化时间戳为可读的日期字符串
export const formatDate = (timestamp?: number | string) => {
  if (!timestamp) return '';
  
  let date: Date;
  
  // 如果是字符串，先尝试解析为数字（Unix时间戳）
  if (typeof timestamp === 'string') {
    // 尝试解析为Unix时间戳
    const unixTime = parseInt(timestamp, 10);
    if (!isNaN(unixTime)) {
      date = new Date(unixTime * 1000); // Unix时间戳是秒，需要转换为毫秒
    } else {
      // 如果不是Unix时间戳，尝试直接解析时间字符串
      date = new Date(timestamp);
    }
  } else {
    // 如果是数字，直接作为Unix时间戳处理
    date = new Date(timestamp * 1000);
  }
  
  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 获取当前Unix时间戳
export const getCurrentTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};