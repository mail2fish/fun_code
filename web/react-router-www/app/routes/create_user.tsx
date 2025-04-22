import * as React from "react"
import { useNavigate } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Toaster } from "sonner"

import { AppSidebar } from "~/components/my-app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 表单验证 Schema
const formSchema = z.object({
  username: z.string().min(3, {
    message: "用户名至少需要 3 个字符",
  }).max(50, {
    message: "用户名不能超过 50 个字符",
  }),
  nickname: z.string().max(50, {
    message: "昵称不能超过 50 个字符",
  }).optional(),
  email: z.string()
    .max(100, {
      message: "邮箱不能超过 100 个字符",
    })
    .optional()
    .transform(e => e === "" ? undefined : e)
    .refine((val) => val === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "请输入有效的邮箱地址",
    }),
  password: z.string().min(6, {
    message: "密码至少需要 6 个字符",
  }).max(100, {
    message: "密码不能超过 100 个字符",
  }),
  role: z.enum(["admin", "teacher", "student"], {
    required_error: "请选择用户角色",
  }),
});

// 创建用户
async function createUser(userData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: userData.username,
        nickname: userData.nickname || "",
        email: userData.email || "",
        password: userData.password,
        role: userData.role,
      }),
    });

    const data = await response.json();
    console.log("API 响应:", data);

    if (!response.ok) {
      throw new Error(data.error || `API 错误: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("创建用户失败:", error);
    throw error;
  }
}

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      nickname: "",
      email: "",
      password: "",
      role: "student",
    },
  });

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      const result = await createUser(values);
      console.log("表单提交成功:", result);
      
      toast.success("用户创建成功", {
        description: "即将跳转到用户列表页面",
        duration: 2000,
        style: {
          background: '#4CAF50',
          color: 'white',
        }
      });
      
      // 创建成功后跳转到用户列表页
      setTimeout(() => {
        navigate("/www/users/list");
      }, 2000);
    } catch (error) {
      console.error("提交表单失败:", error);
      toast.error("创建失败", {
        description: error instanceof Error ? error.message : "未知错误",
        duration: 2000,
        style: {
          background: '#f44336',
          color: 'white',
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Toaster 
          position="top-right"
          theme="light"
          richColors
        />
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/www/users/list">
                    用户管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>创建新用户</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">创建新用户</h3>
                <p className="text-sm text-muted-foreground">
                  填写以下信息创建一个新的用户账号。
                </p>
              </div>
              <Separator />
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>用户名</FormLabel>
                        <FormControl>
                          <Input placeholder="请输入用户名" {...field} />
                        </FormControl>
                        <FormDescription>
                          用户名将用于登录系统
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>昵称</FormLabel>
                        <FormControl>
                          <Input placeholder="请输入昵称" {...field} />
                        </FormControl>
                        <FormDescription>
                          昵称将显示在系统中
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input placeholder="请输入邮箱" type="email" {...field} />
                        </FormControl>
                        <FormDescription>
                          请输入有效的邮箱地址
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <Input placeholder="请输入密码" type="password" {...field} />
                        </FormControl>
                        <FormDescription>
                          密码至少需要 6 个字符
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>角色</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择用户角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">管理员</SelectItem>
                            <SelectItem value="teacher">教师</SelectItem>
                            <SelectItem value="student">学生</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          选择用户的角色
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-4">
                    <Button 
                      variant="outline" 
                      type="button"
                      onClick={() => navigate("/www/users/list")}
                      disabled={isSubmitting}
                    >
                      取消
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "创建中..." : "创建用户"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
