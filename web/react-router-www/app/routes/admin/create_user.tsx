import * as React from "react"
import { useNavigate } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Toaster } from "sonner"

import { AdminLayout } from "~/components/admin-layout"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { useUser } from "~/hooks/use-user"

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
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/create`, {
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
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdUsername, setCreatedUsername] = React.useState("");
  const { userInfo, logout } = useUser();

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
      
      // 保存创建的用户名并显示成功对话框
      setCreatedUsername(values.username);
      setShowSuccessDialog(true);
      
      toast.success("用户创建成功", {
        description: `用户 "${values.username}" 已成功创建`,
        duration: 3000,
        style: {
          background: '#4CAF50',
          color: 'white',
        }
      });
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

  // 处理继续创建用户
  const handleContinueCreate = () => {
    setShowSuccessDialog(false);
    form.reset({
      username: "",
      nickname: "",
      email: "",
      password: "",
      role: "student",
    });
    toast.success("表单已重置", {
      description: "您可以继续创建新用户",
      duration: 2000,
    });
  };

  // 处理转到用户列表
  const handleGoToList = () => {
    setShowSuccessDialog(false);
    navigate("/www/admin/list_users");
  };

  const adminInfo = userInfo ? {
    name: userInfo.nickname || userInfo.username,
    role: userInfo.role === 'admin' ? '管理员' : 
          userInfo.role === 'teacher' ? '教师' : '学生'
  } : undefined;

  return (
    <AdminLayout
      adminInfo={adminInfo}
      onLogout={logout}
    >
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
      
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">创建新用户</h1>
        <p className="text-gray-600">填写以下信息创建一个新的用户账号</p>
      </div>
      
      {/* 表单容器 */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">用户名 *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="请输入用户名" 
                        {...field} 
                        className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      用户名将用于登录系统，至少3个字符
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
                    <FormLabel className="text-gray-700 font-medium">昵称</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="请输入昵称" 
                        {...field} 
                        className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      昵称将显示在系统中，可选填
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
                    <FormLabel className="text-gray-700 font-medium">邮箱</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="请输入邮箱" 
                        type="email" 
                        {...field} 
                        className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      请输入有效的邮箱地址，可选填
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
                    <FormLabel className="text-gray-700 font-medium">密码 *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="请输入密码" 
                        type="password" 
                        {...field} 
                        className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
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
                    <FormLabel className="text-gray-700 font-medium">角色 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue placeholder="选择用户角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            管理员
                          </div>
                        </SelectItem>
                        <SelectItem value="teacher">
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            教师
                          </div>
                        </SelectItem>
                        <SelectItem value="student">
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            学生
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-gray-500">
                      选择用户在系统中的角色
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* 操作按钮 */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => navigate("/www/admin/users/list")}
                  disabled={isSubmitting}
                  className="px-6"
                >
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? "创建中..." : "创建用户"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* 成功创建后的选择对话框 */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600">🎉 用户创建成功！</DialogTitle>
            <DialogDescription>
              用户 <strong className="text-gray-900">"{createdUsername}"</strong> 已成功创建。您希望接下来做什么？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleContinueCreate}
              className="flex-1"
            >
              继续创建用户
            </Button>
            <Button 
              onClick={handleGoToList}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              转到用户列表
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
