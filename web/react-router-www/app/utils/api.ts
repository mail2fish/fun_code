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
  return fetch(url, newOptions);
};