import * as React from "react"
import { useNavigate, useParams } from "react-router"
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

import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

const formSchema = z.object({
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
  password: z.string().max(100, {
    message: "密码不能超过 100 个字符",
  }).optional(),
  role: z.enum(["admin", "teacher", "student"], {
    required_error: "请选择用户角色",
  }),
});

async function getUser(userId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/${userId}`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("获取用户信息失败:", error);
    throw error;
  }
}

async function updateUser(userId: string, userData: z.infer<typeof formSchema>) {
  try {
    console.log("发送到后端的用户数据:", userData); // 调试信息
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `API 错误: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error("更新用户失败:", error);
    throw error;
  }
}

export default function EditUserPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: "",
      email: "",
      password: "",
      role: "student",
    },
  });

  React.useEffect(() => {
    async function loadUser() {
      try {
        const resp = await getUser(userId!);
        const userData = resp.data;
        setUsername(userData.username);
        form.reset({
          nickname: userData.nickname || "",
          email: userData.email || "",
          password: "",
          role: userData.role,
        });
      } catch (error) {
        toast.error("加载用户信息失败");
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      loadUser();
    }
  }, [userId, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      console.log("提交的用户数据:", values); // 调试信息
      await updateUser(userId!, values);
      setShowSuccessDialog(true);
      toast.success("用户更新成功", {
        description: "用户信息已成功更新",
        duration: 2000,
        style: {
          background: '#4CAF50',
          color: 'white',
        }
      });
    } catch (error) {
      toast.error("更新失败", {
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

  // 处理返回用户列表
  const handleGoToList = () => {
    setShowSuccessDialog(false);
    navigate("/www/admin/list_users");
  };

  if (isLoading) {
    return <div>加载中...</div>;
  }

  return (
    <AdminLayout>
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">编辑用户</h1>
        <p className="text-gray-600">修改用户信息。用户名不可更改。</p>
      </div>
      {/* 表单容器 */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormItem>
                <FormLabel className="text-gray-700 font-medium">用户名</FormLabel>
                <FormControl>
                  <Input value={username} disabled className="h-10 border-gray-300 bg-gray-100" />
                </FormControl>
                <FormDescription className="text-gray-500">
                  用户名不可修改
                </FormDescription>
              </FormItem>
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">昵称</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入昵称" {...field} className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
                    </FormControl>
                    <FormDescription className="text-gray-500">
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
                    <FormLabel className="text-gray-700 font-medium">邮箱</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入邮箱" type="email" {...field} className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
                    </FormControl>
                    <FormDescription className="text-gray-500">
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
                    <FormLabel className="text-gray-700 font-medium">密码</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="留空表示不修改密码" 
                        type="password" 
                        {...field} 
                        className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </FormControl>
                    <FormDescription className="text-gray-500">
                      如不修改密码请留空
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
                    <FormLabel className="text-gray-700 font-medium">角色</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                      选择用户的角色
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
                  onClick={handleGoToList}
                  disabled={isSubmitting}
                  className="px-6"
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting} className="px-6 bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? "保存中..." : "保存修改"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
      {/* 成功编辑后的对话框 */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600">✅ 用户信息已更新！</DialogTitle>
            <DialogDescription>
              用户 <strong className="text-gray-900">"{username}"</strong> 的信息已成功更新。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button 
              onClick={handleGoToList}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              返回用户列表
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
