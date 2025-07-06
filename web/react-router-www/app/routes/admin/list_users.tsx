import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconLoader, IconUsers } from "@tabler/icons-react"

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
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "~/components/ui/select"
import { toast } from "sonner"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// API 服务
import { HOST_URL } from "~/config"

// 用户类型定义
interface User {
  id: number
  username: string
  nickname: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export default function ListUsersPage() {
  // 基础状态
  const [users, setUsers] = React.useState<User[]>([])
  const [total, setTotal] = React.useState(0)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  const [searchKeyword, setSearchKeyword] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  
  // 加载状态
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  
  // 排序控制
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")
  
  // 防并发和节流控制
  const [lastRequestTime, setLastRequestTime] = React.useState(0)
  const requestInProgress = React.useRef(false)
  const REQUEST_INTERVAL = 300

  // 保存当前用户数据的引用，避免循环依赖
  const usersRef = React.useRef<User[]>([])
  
  // 同步 users 状态到 ref
  React.useEffect(() => {
    usersRef.current = users
  }, [users])

  // fetchData 用 useCallback 包裹，依赖 sortOrder、searchKeyword
  const fetchData = React.useCallback(async ({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) => {
    let ignore = false;
    const pageSize = 20;
    let beginID = "0";
    let forward = true;
    const asc = sortOrder === "asc";
    const currentUsers = usersRef.current;

    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && currentUsers.length > 0) {
      if (direction === "up") {
        beginID = currentUsers[0].id.toString();
        forward = false;
      } else {
        beginID = currentUsers[currentUsers.length - 1].id.toString();
        forward = true;
      }
    }

    if (direction === "up") setLoadingTop(true);
    if (direction === "down") setLoadingBottom(true);

    try {
      const params = new URLSearchParams();
      params.append("pageSize", String(pageSize));
      params.append("forward", String(forward));
      params.append("asc", String(asc));
      if (beginID !== "0") params.append("beginID", beginID);
      if (searchKeyword) params.append("keyword", searchKeyword);
      const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?${params.toString()}`);
      const resp = await res.json();
      if (ignore) return;
      let newUsers: User[] = [];
      if (Array.isArray(resp.data)) {
        newUsers = resp.data;
      }
      if (resp.meta?.total !== undefined) {
        setTotal(resp.meta.total);
      }
      if (reset) {
        setUsers(newUsers);
        setHasMoreTop(false);
        setHasMoreBottom(resp.meta?.has_next || false);
        setInitialLoading(false);
        return;
      }
      if (direction === "up") {
        if (newUsers.length === 0) {
          setHasMoreTop(false);
        } else {
          setUsers(prev => {
            const prevIds = new Set(prev.map(user => user.id));
            const uniqueNewUsers = newUsers.filter((user: User) => !prevIds.has(user.id));
            const merged = [...uniqueNewUsers, ...prev];
            const trimmed = merged.slice(0, 50);
            return trimmed;
          });
          const prevIds = new Set(currentUsers.map(user => user.id));
          const uniqueCount = newUsers.filter((user: User) => !prevIds.has(user.id)).length;
          if (uniqueCount === 0) {
            setHasMoreTop(false);
          } else {
            setHasMoreBottom(true);
          }
        }
      } else {
        if (newUsers.length === 0) {
          setHasMoreBottom(false);
        } else {
          setUsers(prev => {
            const prevIds = new Set(prev.map(user => user.id));
            const uniqueNewUsers = newUsers.filter((user: User) => !prevIds.has(user.id));
            const merged = [...prev, ...uniqueNewUsers];
            const trimmed = merged.slice(-50);
            return trimmed;
          });
          const prevIds = new Set(currentUsers.map(user => user.id));
          const uniqueCount = newUsers.filter((user: User) => !prevIds.has(user.id)).length;
          const newHasMoreBottom = (resp.meta?.has_next || false) && uniqueCount > 0;
          setHasMoreBottom(newHasMoreBottom);
          if (uniqueCount > 0) {
            setHasMoreTop(true);
          }
        }
      }
    } catch (error) {
      if (!ignore) {
        console.error("API请求失败:", error);
        toast.error("加载数据失败");
      }
    } finally {
      if (!ignore) {
        if (direction === "up") setLoadingTop(false);
        if (direction === "down") setLoadingBottom(false);
      }
    }
    return () => { ignore = true; };
  }, [sortOrder, searchKeyword]);

  // 初始化数据加载
  React.useEffect(() => {
    setInitialLoading(true);
    fetchData({ direction: "down", reset: true, customBeginID: "0" });
  }, [fetchData]);

  // 监听排序变化
  React.useEffect(() => {
    if (!initialLoading) {
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
    }
  }, [sortOrder, initialLoading, fetchData]);

  // 监听搜索变化
  React.useEffect(() => {
    if (searchKeyword) {
      fetchData({ direction: "down", reset: true, customBeginID: "0" });
    }
  }, [searchKeyword, fetchData]);

  // 刷新数据
  const refreshData = React.useCallback(async () => {
    setHasMoreTop(false);
    setHasMoreBottom(true);
    setInitialLoading(true);
    fetchData({ direction: "down", reset: true, customBeginID: "0" });
  }, [fetchData]);

  // 用户名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!searchKeyword || searchKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setUsers([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setInitialLoading(true);
      
      // 直接调用API而不是通过fetchData，避免循环依赖
      const loadInitialData = async () => {
        try {
          const pageSize = 20
          const asc = sortOrder === "asc"
          const params = new URLSearchParams()
          params.append("pageSize", String(pageSize))
          params.append("forward", "true")
          params.append("asc", String(asc))
          params.append("beginID", "0")
          
          const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?${params.toString()}`)
          const resp = await res.json()

          let newUsers: User[] = [];
          if (Array.isArray(resp.data)) {
            newUsers = resp.data;
          }

          setUsers(newUsers)
          setTotal(resp.meta?.total || 0)
          setHasMoreTop(true)
          setHasMoreBottom(resp.meta?.has_next || false)
          setInitialLoading(false)
        } catch (error) {
          console.error("加载初始数据失败:", error)
          setUsers([])
          setTotal(0)
          setInitialLoading(false)
          toast.error("加载数据失败")
        }
      }
      
      loadInitialData()
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/search?keyword=${encodeURIComponent(searchKeyword)}`);
        const data = await res.json();
        
        if (Array.isArray(data.data)) {
          setUsers(data.data);
          setTotal(data.data.length);
        } else {
          setUsers([]);
          setTotal(0);
        }
        
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setInitialLoading(false);
      } catch (error) {
        console.error("搜索用户失败:", error);
        setUsers([]);
        setTotal(0);
        toast.error("搜索用户失败");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, sortOrder]);

  // 顶部自动检测，解决向上翻页 scroll 事件未触发的问题
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('.overflow-auto') as HTMLDivElement;
      if (!container) return;
      if (container.scrollTop === 0 && hasMoreTop && !loadingTop) {
        fetchData({ direction: "up" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [users.length, hasMoreTop, loadingTop, fetchData]);

  // 滚动处理
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = el
    
    // 简单边界检测
    if (scrollTop === 0 && hasMoreTop && !loadingTop && !requestInProgress.current) {
      fetchData({ direction: "up" })
    }
    
    if (scrollHeight - scrollTop - clientHeight < 10 && hasMoreBottom && !loadingBottom && !requestInProgress.current) {
      fetchData({ direction: "down" })
    }
  }
  
    // 格式化日期
    const formatDate = (dateString?: string) => {
      if (!dateString) return "未知日期"
      
      try {
        const date = new Date(dateString)
        
        if (isNaN(date.getTime())) {
          return "未知日期"
        }
        
        return date.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        })
      } catch (error) {
        return "日期格式错误"
      }
    }
  
  // 处理删除用户
  const handleDeleteUser = React.useCallback(async (id: number) => {
    setDeletingId(id)
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
      }
      
      setUsers(prev => prev.filter(u => u.id !== id))
      setTotal(prev => prev - 1)
      toast.success("用户已成功删除")
    } catch (error) {
      console.error("删除用户失败:", error)
      toast.error("删除用户时出现错误")
    } finally {
      setDeletingId(null)
    }
  }, [])

  // 处理新建用户按钮点击
  const handleNewUserClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 1000) // 1秒冷却时间
  }

  if (initialLoading) {
    return (
      <AdminLayout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex items-center space-x-2">
            <IconLoader className="h-6 w-6 animate-spin" />
            <span>加载中...</span>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="flex flex-1 flex-col gap-4">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconUsers className="h-6 w-6" />
            <h1 className="text-2xl font-bold">用户管理</h1>
            <span className="text-sm text-gray-500">
              (共{total}个, 显示{users.length}个)
            </span>
            {/* 加载状态指示器 */}
            {(initialLoading || loadingTop || loadingBottom) && (
              <div className="flex items-center gap-1 ml-4 px-2 py-1 bg-blue-100 rounded-full">
                <IconLoader className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-xs text-blue-600">
                  {initialLoading ? "初始化" : loadingTop ? "加载历史" : "加载更多"}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 搜索框 */}
            <input
              className="w-48 h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="搜索用户名称"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
            
            {/* 排序控制 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">📅 排序：</span>
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">🆕 最新优先</SelectItem>
                  <SelectItem value="asc">⏰ 最旧优先</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 刷新按钮 */}
            <Button variant="outline" size="sm" onClick={refreshData}>
              <IconRefresh className="h-4 w-4 mr-1" />
              刷新
            </Button>
            
            {/* 新建用户 */}
            <Link 
              to="/www/admin/create_user" 
              onClick={handleNewUserClick}
              className={isButtonCooling ? 'pointer-events-none' : ''}
            >
              <Button disabled={isButtonCooling}>
                <IconPlus className="mr-2 h-4 w-4" />
                {isButtonCooling ? "请稍候..." : "创建用户"}
              </Button>
            </Link>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="rounded-md border flex flex-col max-h-[70vh]">
          <div 
            className="flex-1 overflow-auto px-1"
            onScroll={searchKeyword ? undefined : handleScroll}
          >
            {/* 向上加载指示器 */}
            {loadingTop && (
              <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
                <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                <span className="text-blue-700 text-sm">正在加载历史数据...</span>
              </div>
            )}
            
            {/* 搜索状态 */}
            {searchKeyword.length >= 1 && searching && (
              <div className="text-center text-sm text-gray-500 py-4">搜索中...</div>
            )}
            {searchKeyword.length >= 1 && !searching && users.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-4">无匹配用户</div>
            )}
            
            {/* 顶部提示 */}
            {!loadingTop && hasMoreTop && users.length > 0 && !searchKeyword && (
              <div className="flex items-center justify-center py-3 bg-green-50 border border-green-200 rounded-lg mx-4 my-2">
                <span className="text-green-700 text-sm">
                  👥 还有更多历史用户数据，向上滚动或使用按钮加载
                </span>
              </div>
            )}

            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="font-semibold">用户名</TableHead>
                  <TableHead className="font-semibold">昵称</TableHead>
                  <TableHead className="font-semibold">邮箱</TableHead>
                  <TableHead className="font-semibold">角色</TableHead>
                  <TableHead className="font-semibold">创建时间</TableHead>
                  <TableHead className="font-semibold">更新时间</TableHead>
                  <TableHead className="font-semibold w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="empty-state">
                        <IconUsers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-500">暂无用户数据</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Link 
                          to={`/www/admin/edit_user/${user.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {user.username}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/www/admin/edit_user/${user.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {user.nickname || '-'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/www/admin/edit_user/${user.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {user.email || '-'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role === 'admin' ? '管理员' : 
                           user.role === 'teacher' ? '教师' : '学生'}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{formatDate(user.created_at)}</TableCell>
                      <TableCell className="text-gray-600">{formatDate(user.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="编辑"
                            asChild
                            className="h-8 w-8"
                          >
                            <Link to={`/www/admin/edit_user/${user.id}`}>
                              <IconEdit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="删除"
                                className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>确认删除</DialogTitle>
                                <DialogDescription>
                                  您确定要删除用户 "{user.username}" 吗？此操作将永久删除该用户及其所有数据，且无法恢复。
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">取消</Button>
                                </DialogClose>
                                <Button 
                                  variant="destructive" 
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deletingId === user.id}
                                >
                                  {deletingId === user.id ? "删除中..." : "删除"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* 向下加载指示器 */}
            {loadingBottom && (
              <div className="flex items-center justify-center py-4 bg-blue-50 border border-blue-200 rounded-lg mx-4 my-2">
                <IconLoader className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                <span className="text-blue-700 text-sm">正在加载更多数据...</span>
              </div>
            )}

            {/* 数据状态提示 */}
            {users.length > 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-500">
                <span className="text-sm">
                  当前显示 {users.length} 条数据 / 共 {total} 条
                </span>
                <span className="text-xs mt-1">
                  ID范围: {users[0]?.id} ~ {users[users.length-1]?.id}
                  {!hasMoreTop && !hasMoreBottom && " (已加载全部)"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
