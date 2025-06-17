import { useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

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

      // 保存用户信息和令牌到本地存储
      localStorage.setItem("token", response.data.data.token);
      // localStorage.setItem("user", JSON.stringify(response.data.user));

      // 登录成功后跳转到 scratch/projects 页面
      navigate("/www/scratch/projects");
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
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">登录您的账户</h1>
        <p className="text-muted-foreground text-sm text-balance">
          输入您的用户名和密码登录账户
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="username">用户名</Label>
          <Input 
            id="username" 
            name="username"
            placeholder="请输入用户名" 
            required 
            value={username}
            onChange={onChange}
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">密码</Label>
            {/* <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              忘记密码?
            </a> */}
          </div>
          <Input 
            id="password" 
            name="password"
            type="password" 
            required 
            value={password}
            onChange={onChange}
          />
        </div>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "登录中..." : "登录"}
        </Button>
      </div>
      {/* <div className="text-center text-sm">
        还没有账户?{" "}
        <a href="/register" className="underline underline-offset-4">
          注册
        </a>
      </div> */}
    </form>
  )
}
