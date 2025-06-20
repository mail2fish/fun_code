import * as React from "react"
import { useNavigate, useParams } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parse } from "date-fns"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
import { Calendar } from "~/components/ui/calendar"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "sonner"
import { Skeleton } from "~/components/ui/skeleton"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 班级数据接口
interface ClassData {
  id: number
  name: string
  description: string
  code: string
  teacher_id: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// 表单验证 Schema
const formSchema = z.object({
  name: z.string().min(2, {
    message: "班级名称至少需要 2 个字符",
  }).max(100, {
    message: "班级名称不能超过 100 个字符",
  }),
  description: z.string().max(500, {
    message: "班级描述不能超过 500 个字符",
  }).optional(),
  startDate: z.date({
    required_error: "请选择开课日期",
  }),
  endDate: z.date({
    required_error: "请选择结课日期",
  }),
  isActive: z.boolean(),
}).refine(data => data.endDate > data.startDate, {
  message: "结课日期必须晚于开课日期",
  path: ["endDate"],
});

// 获取班级信息
async function getClass(classId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/${classId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API 错误: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data as ClassData;
  } catch (error) {
    console.error("获取班级信息失败:", error);
    throw error;
  }
}

// 更新班级
async function updateClass(classId: string, classData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/${classId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: classData.name,
        description: classData.description || "",
        start_date: format(classData.startDate, "yyyy-MM-dd"),
        end_date: format(classData.endDate, "yyyy-MM-dd"),
        is_active: classData.isActive,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API 错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("更新班级失败:", error);
    throw error;
  }
}

export default function EditClassPage() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [classData, setClassData] = React.useState<ClassData | null>(null);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)),
      isActive: true,
    },
  });

  // 加载班级数据
  React.useEffect(() => {
    if (!classId) {
      setError("班级ID无效");
      setIsLoading(false);
      return;
    }

    const loadClassData = async () => {
      try {
        setIsLoading(true);
        const data = await getClass(classId);
        setClassData(data);
        
        // 解析日期字符串为 Date 对象
        const startDate = parse(data.start_date, "yyyy-MM-dd", new Date());
        const endDate = parse(data.end_date, "yyyy-MM-dd", new Date());
        
        // 设置表单默认值
        form.reset({
          name: data.name,
          description: data.description,
          startDate,
          endDate,
          isActive: data.is_active,
        });
        
        setError(null);
      } catch (error) {
        console.error("加载班级数据失败:", error);
        setError(error instanceof Error ? error.message : "加载班级数据失败");
        toast("加载班级数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadClassData();
  }, [classId, form]);

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!classId) {
      toast("班级ID无效");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateClass(classId, values);
      
      toast("班级更新成功");
      
      // 更新成功后跳转到班级列表页
      setTimeout(() => {
        navigate("/www/classes/list");
      }, 2000);
    } catch (error) {
      console.error("提交表单失败:", error);
      toast("更新失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
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
                  <BreadcrumbLink href="/classes">
                    班级管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>编辑班级</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">编辑班级</h3>
                <p className="text-sm text-muted-foreground">
                  修改班级信息，包括名称、描述、开课和结课日期等。
                </p>
              </div>
              <Separator />
              
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="flex justify-end space-x-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-md bg-destructive/15 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-destructive" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-destructive">加载失败</h3>
                      <div className="mt-2 text-sm text-destructive/80">
                        <p>{error}</p>
                      </div>
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate("/www/classes/list")}
                        >
                          返回班级列表
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>班级名称</FormLabel>
                          <FormControl>
                            <Input placeholder="例如：2023 秋季 Python 编程班" {...field} />
                          </FormControl>
                          <FormDescription>
                            这将是班级的显示名称，学生将看到这个名称。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>班级描述</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="描述这个班级的内容、目标或其他信息..."
                              className="resize-none"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            简要描述班级的内容和目标，帮助学生了解这个班级。
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>开课日期</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={`w-full pl-3 text-left font-normal ${
                                      !field.value ? "text-muted-foreground" : ""
                                    }`}
                                  >
                                    {field.value ? (
                                      format(field.value, "yyyy-MM-dd")
                                    ) : (
                                      <span>选择日期</span>
                                    )}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              班级的开始日期
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>结课日期</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={`w-full pl-3 text-left font-normal ${
                                      !field.value ? "text-muted-foreground" : ""
                                    }`}
                                  >
                                    {field.value ? (
                                      format(field.value, "yyyy-MM-dd")
                                    ) : (
                                      <span>选择日期</span>
                                    )}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription>
                              班级的结束日期
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              checked={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              班级状态
                            </FormLabel>
                            <FormDescription>
                              激活状态的班级对学生可见，可以加入和参与活动。
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    {classData && (
                      <div className="rounded-md bg-muted p-4 text-sm">
                        <p className="font-medium">班级信息</p>
                        <p className="mt-1">班级代码: <span className="font-mono">{classData.code}</span></p>
                        <p className="mt-1">创建时间: {new Date(classData.created_at).toLocaleString()}</p>
                      </div>
                    )}
                    <div className="flex justify-end space-x-4">
                      <Button 
                        variant="outline" 
                        type="button"
                        onClick={() => navigate("/www/classes/list")}
                        disabled={isSubmitting}
                      >
                        取消
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "保存中..." : "保存修改"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}