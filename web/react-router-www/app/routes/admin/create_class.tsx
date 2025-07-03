import * as React from "react"
import { Link, useNavigate } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { AdminLayout } from "~/components/admin-layout"
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
import { Textarea } from "~/components/ui/textarea"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Badge } from "~/components/ui/badge"
import { toast } from "sonner" 

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 学生数据接口
interface Student {
  id: number
  nickname: string
  username: string
  email: string
  role: string
}

// 课程数据接口
interface Course {
  id: number
  title: string
  description: string
  author_id: number
  is_published: boolean
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
  studentIds: z.array(z.number()).optional(),
  courseIds: z.array(z.number()).optional(),
}).refine(data => data.endDate > data.startDate, {
  message: "结课日期必须晚于开课日期",
  path: ["endDate"],
});

// 获取学生列表
async function getStudents() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?role=student&pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    return Array.isArray(data.data) ? data.data : []
  } catch (error) {
    console.error("获取学生列表失败:", error)
    return []
  }
}

// 获取课程列表
async function getCourses() {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/courses?pageSize=100`)
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`)
    }
    const data = await response.json()
    return Array.isArray(data.data) ? data.data : []
  } catch (error) {
    console.error("获取课程列表失败:", error)
    return []
  }
}

// 创建班级
async function createClass(classData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: classData.name,
        description: classData.description || "",
        start_date: format(classData.startDate, "yyyy-MM-dd"),
        end_date: format(classData.endDate, "yyyy-MM-dd"),
        student_ids: classData.studentIds || [],
        course_ids: classData.courseIds || [],
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
  const [loading, setLoading] = React.useState(false)
  const [studentDialogOpen, setStudentDialogOpen] = React.useState(false)
  const [courseDialogOpen, setCourseDialogOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [courseSearchQuery, setCourseSearchQuery] = React.useState("")
  const [students, setStudents] = React.useState<Student[]>([])
  const [courses, setCourses] = React.useState<Course[]>([])
  const [selectedStudents, setSelectedStudents] = React.useState<Student[]>([])
  const [selectedCourses, setSelectedCourses] = React.useState<Course[]>([])
  const [loadingStudents, setLoadingStudents] = React.useState(false)
  const [loadingCourses, setLoadingCourses] = React.useState(false)
  const navigate = useNavigate()

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)), // 默认结束日期为 4 个月后
      studentIds: [],
      courseIds: [],
    },
  });

  // 加载学生和课程数据
  React.useEffect(() => {
    const loadData = async () => {
      const [studentList, courseList] = await Promise.all([
        getStudents(),
        getCourses()
      ]);
      setStudents(studentList);
      setCourses(courseList);
    };
    loadData();
  }, []);

  // 处理学生选择
  const handleStudentSelect = (student: Student) => {
    const isSelected = selectedStudents.some(s => s.id === student.id);
    let newSelectedStudents;
    
    if (isSelected) {
      newSelectedStudents = selectedStudents.filter(s => s.id !== student.id);
    } else {
      newSelectedStudents = [...selectedStudents, student];
    }
    
    setSelectedStudents(newSelectedStudents);
    form.setValue('studentIds', newSelectedStudents.map(s => s.id));
  };

  // 移除选中的学生
  const handleRemoveStudent = (studentId: number) => {
    const newSelectedStudents = selectedStudents.filter(s => s.id !== studentId);
    setSelectedStudents(newSelectedStudents);
    form.setValue('studentIds', newSelectedStudents.map(s => s.id));
  };

  // 处理课程选择
  const handleCourseSelect = (course: Course) => {
    const isSelected = selectedCourses.some(c => c.id === course.id);
    let newSelectedCourses;
    
    if (isSelected) {
      newSelectedCourses = selectedCourses.filter(c => c.id !== course.id);
    } else {
      newSelectedCourses = [...selectedCourses, course];
    }
    
    setSelectedCourses(newSelectedCourses);
    form.setValue('courseIds', newSelectedCourses.map(c => c.id));
  };

  // 移除选中的课程
  const handleRemoveCourse = (courseId: number) => {
    const newSelectedCourses = selectedCourses.filter(c => c.id !== courseId);
    setSelectedCourses(newSelectedCourses);
    form.setValue('courseIds', newSelectedCourses.map(c => c.id));
  };

  // 过滤学生列表
  const filteredStudents = students.filter(student =>
    student.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 过滤课程列表
  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
    course.description.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setLoading(true);
      const result = await createClass(values);
      
      toast.success("班级创建成功");
      
      // 创建成功后跳转到班级列表页
      setTimeout(() => {
        navigate("/www/admin/list_classes");
      }, 2000);
    } catch (error) {
      console.error("提交表单失败:", error);
      toast.error("创建失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-2xl">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">创建新班级</h3>
            <p className="text-sm text-muted-foreground">
              填写以下信息创建一个新的班级。创建后，您将获得一个邀请码，可以分享给学生加入班级。
            </p>
          </div>
          
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

              {/* 学生选择 */}
              <FormField
                control={form.control}
                name="studentIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择学生</FormLabel>
                    <div className="space-y-3">
                      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>
                              {selectedStudents.length > 0 
                                ? `已选择 ${selectedStudents.length} 名学生` 
                                : "选择学生"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>选择学生</DialogTitle>
                            <DialogDescription>
                              选择要加入班级的学生。可以多选。
                            </DialogDescription>
                          </DialogHeader>
                          <Command>
                            <CommandInput 
                              placeholder="搜索学生..." 
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                            />
                            <CommandList className="max-h-64">
                              <CommandEmpty>未找到学生。</CommandEmpty>
                              <CommandGroup>
                                {filteredStudents.map((student) => {
                                  const isSelected = selectedStudents.some(s => s.id === student.id);
                                  return (
                                    <CommandItem
                                      key={student.id}
                                      onSelect={() => handleStudentSelect(student)}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          isSelected ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{student.nickname}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {student.username} • {student.email}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </DialogContent>
                      </Dialog>
                      
                      {/* 显示已选择的学生 */}
                      {selectedStudents.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedStudents.map((student) => (
                            <Badge key={student.id} variant="secondary" className="pr-1">
                              {student.nickname}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleRemoveStudent(student.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      选择要加入这个班级的学生。也可以稍后通过班级代码邀请学生加入。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 课程选择 */}
              <FormField
                control={form.control}
                name="courseIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>选择课程</FormLabel>
                    <div className="space-y-3">
                      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>
                              {selectedCourses.length > 0 
                                ? `已选择 ${selectedCourses.length} 门课程` 
                                : "选择课程"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>选择课程</DialogTitle>
                            <DialogDescription>
                              选择要加入班级的课程。可以多选。
                            </DialogDescription>
                          </DialogHeader>
                          <Command>
                            <CommandInput 
                              placeholder="搜索课程..." 
                              value={courseSearchQuery}
                              onValueChange={setCourseSearchQuery}
                            />
                            <CommandList className="max-h-64">
                              <CommandEmpty>未找到课程。</CommandEmpty>
                              <CommandGroup>
                                {filteredCourses.map((course) => {
                                  const isSelected = selectedCourses.some(c => c.id === course.id);
                                  return (
                                    <CommandItem
                                      key={course.id}
                                      onSelect={() => handleCourseSelect(course)}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          isSelected ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{course.title}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {course.description}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </DialogContent>
                      </Dialog>
                      
                      {/* 显示已选择的课程 */}
                      {selectedCourses.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedCourses.map((course) => (
                            <Badge key={course.id} variant="secondary" className="pr-1">
                              {course.title}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => handleRemoveCourse(course.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <FormDescription>
                      选择要包含在这个班级中的课程。学生可以学习这些课程内容。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-4">
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => navigate("/www/admin/list_classes")}
                  disabled={loading}
                >
                  取消
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "创建中..." : "创建班级"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </AdminLayout>
  )
}