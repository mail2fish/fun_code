import * as React from "react"
import { useNavigate, useParams } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parse } from "date-fns"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Check, ChevronsUpDown, X, Plus, Trash2 } from "lucide-react"

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
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"

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
  teacher?: {
    id: number
    username: string
    email: string
  }
  students?: {
    id: number
    nickname: string
    username: string
    email: string
  }[]
  students_count: number
  courses?: {
    id: number
    title: string
    description: string
    author_id: number
  }[]
  courses_count: number
}

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
  studentIds: z.array(z.number()).optional(),
  courseIds: z.array(z.number()).optional(),
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
    
    const result = await response.json();
    return result.data as ClassData;
  } catch (error) {
    console.error("获取班级信息失败:", error);
    throw error;
  }
}

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

// 更新班级
async function updateClass(classId: string, classData: z.infer<typeof formSchema>) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/admin/classes/${classId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        class_id: parseInt(classId),
        name: classData.name,
        description: classData.description || "",
        start_date: format(classData.startDate, "yyyy-MM-dd"),
        end_date: format(classData.endDate, "yyyy-MM-dd"),
        is_active: classData.isActive,
        student_ids: classData.studentIds || [],
        course_ids: classData.courseIds || [],
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
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [classData, setClassData] = React.useState<ClassData | null>(null);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = React.useState<Student[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [selectedCourses, setSelectedCourses] = React.useState<Course[]>([]);
  const [studentDialogOpen, setStudentDialogOpen] = React.useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [courseSearchQuery, setCourseSearchQuery] = React.useState("");

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)),
      isActive: true,
      studentIds: [],
      courseIds: [],
    },
  });

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

  // 加载班级数据
  React.useEffect(() => {
    if (!classId) {
      setError("班级ID无效");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // 并行加载班级数据、学生列表和课程列表
        const [classData, allStudents, allCourses] = await Promise.all([
          getClass(classId),
          getStudents(),
          getCourses()
        ]);
        
        // 验证返回的数据格式
        if (!classData || typeof classData !== 'object') {
          throw new Error("班级数据格式不正确");
        }
        
        console.log("加载的班级数据:", classData);
        console.log("班级包含的学生:", classData.students);
        console.log("班级包含的课程:", classData.courses);
        
        setClassData(classData);
        setStudents(Array.isArray(allStudents) ? allStudents : []);
        setCourses(Array.isArray(allCourses) ? allCourses : []);
        
        // 从班级数据中获取已选择的学生
        const classStudents = classData.students || [];
        const selectedStudentsList = classStudents.map(s => ({
          id: s.id,
          nickname: s.nickname || s.username, // 优先使用nickname，回退到username
          username: s.username,
          email: s.email,
          role: 'student'
        }));
        setSelectedStudents(selectedStudentsList);

        // 从班级数据中获取已选择的课程
        const classCourses = classData.courses || [];
        setSelectedCourses(classCourses);
        
        // 解析日期字符串为 Date 对象
        let startDate: Date;
        let endDate: Date;
        
        try {
          startDate = classData.start_date ? parse(classData.start_date, "yyyy-MM-dd", new Date()) : new Date();
          endDate = classData.end_date ? parse(classData.end_date, "yyyy-MM-dd", new Date()) : new Date();
          
          // 检查解析后的日期是否有效
          if (isNaN(startDate.getTime())) {
            console.warn("开课日期解析失败，使用默认值:", classData.start_date);
            startDate = new Date();
          }
          if (isNaN(endDate.getTime())) {
            console.warn("结课日期解析失败，使用默认值:", classData.end_date);
            endDate = new Date(new Date().setMonth(new Date().getMonth() + 4));
          }
        } catch (parseError) {
          console.error("日期解析错误:", parseError);
          startDate = new Date();
          endDate = new Date(new Date().setMonth(new Date().getMonth() + 4));
        }
        
                // 设置表单默认值
        form.reset({
          name: classData.name || "",
          description: classData.description || "",
          startDate,
          endDate,
          isActive: Boolean(classData.is_active),
          studentIds: selectedStudentsList.map(s => s.id),
          courseIds: classCourses.map(c => c.id),
        });
        
        setError(null);
      } catch (error) {
        console.error("加载数据失败:", error);
        setError(error instanceof Error ? error.message : "加载数据失败");
        toast.error("加载数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [classId, form]);

  // 提交表单
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // 检查 classId 是否存在且为有效字符串
    if (!classId || typeof classId !== 'string' || classId.trim() === '') {
      console.error("提交时班级ID无效:", { classId });
      toast.error("班级ID无效，无法更新");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateClass(classId, values);
      
      toast.success("班级更新成功");
      
      // 更新成功后跳转到班级列表页
      setTimeout(() => {
        navigate("/www/admin/list_classes");
      }, 2000);
    } catch (error) {
      console.error("提交表单失败:", error);
      toast.error("更新失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-2xl">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">编辑班级</h3>
            <p className="text-sm text-muted-foreground">
              修改班级信息，包括名称、描述、开课和结课日期等。
            </p>
          </div>
          
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
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
                      onClick={() => navigate("/www/admin/list_classes")}
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

                {/* 学生管理 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium">班级学生</h4>
                    <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          添加学生
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>添加学生</DialogTitle>
                          <DialogDescription>
                            选择要加入班级的学生。
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
                                if (isSelected) return null; // 不显示已选择的学生
                                return (
                                  <CommandItem
                                    key={student.id}
                                    onSelect={() => {
                                      handleStudentSelect(student);
                                      setStudentDialogOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
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
                  </div>

                  {selectedStudents.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>姓名</TableHead>
                          <TableHead>用户名</TableHead>
                          <TableHead>邮箱</TableHead>
                          <TableHead className="w-24">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.nickname}</TableCell>
                            <TableCell>{student.username}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveStudent(student.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无学生，点击"添加学生"按钮添加学生到班级
                    </div>
                  )}
                </div>

                {/* 课程管理 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium">班级课程</h4>
                    <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          添加课程
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>添加课程</DialogTitle>
                          <DialogDescription>
                            选择要加入班级的课程。
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
                                if (isSelected) return null; // 不显示已选择的课程
                                return (
                                  <CommandItem
                                    key={course.id}
                                    onSelect={() => {
                                      handleCourseSelect(course);
                                      setCourseDialogOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
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
                  </div>

                  {selectedCourses.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>课程名称</TableHead>
                          <TableHead>课程描述</TableHead>
                          <TableHead className="w-24">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCourses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-medium">{course.title}</TableCell>
                            <TableCell>{course.description}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCourse(course.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无课程，点击"添加课程"按钮添加课程到班级
                    </div>
                  )}
                </div>

                {classData && (
                  <div className="rounded-md bg-muted p-4 text-sm">
                    <p className="font-medium">班级信息</p>
                    <p className="mt-1">班级代码: <span className="font-mono">{classData.code}</span></p>
                    <p className="mt-1">创建时间: {classData.created_at}</p>
                    {classData.students && classData.students.length > 0 && (
                      <p className="mt-1">已关联学生: {classData.students_count} 名</p>
                    )}
                    {classData.courses && classData.courses.length > 0 && (
                      <p className="mt-1">已关联课程: {classData.courses_count} 门</p>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end space-x-4">
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => navigate("/www/admin/list_classes")}
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
    </AdminLayout>
  )
}