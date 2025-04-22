import * as React from "react"
import { useNavigate } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
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
import { toast } from  "sonner" 

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

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
}).refine(data => data.endDate > data.startDate, {
  message: "结课日期必须晚于开课日期",
  path: ["endDate"],
});

// 创建班级
async function createClass(classData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/classes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: classData.name,
        description: classData.description || "",
        start_date: format(classData.startDate, "yyyy-MM-dd"),
        end_date: format(classData.endDate, "yyyy-MM-dd"),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `API 错误: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("创建班级失败:", error);
    throw error;
  }
}

export default function CreateClassPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)), // 默认结束日期为 4 个月后
    },
  });

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      const result = await createClass(values);
      
      toast("班级创建成功");
      
      // 创建成功后跳转到班级列表页
      setTimeout(() => {
        navigate("/www/classes/list");
      }, 2000);
    } catch (error) {
      console.error("提交表单失败:", error);
      toast("创建失败");
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
                  <BreadcrumbLink href="/www/classes/list">
                    班级管理
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>创建新班级</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="mx-auto w-full max-w-2xl">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">创建新班级</h3>
                <p className="text-sm text-muted-foreground">
                  填写以下信息创建一个新的班级。创建后，您将获得一个邀请码，可以分享给学生加入班级。
                </p>
              </div>
              <Separator />
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
                      {isSubmitting ? "创建中..." : "创建班级"}
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