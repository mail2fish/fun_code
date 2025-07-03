import * as React from "react"
import { Link } from "react-router"
import { IconPlus, IconEdit, IconTrash, IconRefresh } from "@tabler/icons-react"

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

// 缓存相关常量
const CACHE_KEY = 'userTableCacheV1';
const CACHE_EXPIRE = 60 * 60 * 1000; // 1小时

export default function ListUsersPage() {
  const [deletingId, setDeletingId] = React.useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  
  // 先尝试从localStorage读取缓存
  const getInitialCache = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_EXPIRE) return null;
      return {
        beginID: 0, // 缓存 beginID 会产生一些奇怪的问题，暂时先禁用
        sortOrder: data.sortOrder,
      };
    } catch {
      return null;
    }
  };
  const initialCache = getInitialCache();
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">(initialCache?.sortOrder || "desc")

  // 无限滚动相关状态
  const [users, setUsers] = React.useState<User[]>([])
  const [hasMoreTop, setHasMoreTop] = React.useState(true)
  const [hasMoreBottom, setHasMoreBottom] = React.useState(true)
  const [loadingTop, setLoadingTop] = React.useState(false)
  const [loadingBottom, setLoadingBottom] = React.useState(false)
  const [localInitialLoading, setLocalInitialLoading] = React.useState(true)
  const [totalUsers, setTotalUsers] = React.useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  // 添加按钮冷却状态
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)

  // 写入缓存
  const saveCache = React.useCallback((beginID: string) => {
    if (typeof window === 'undefined') return;

    let bID = parseInt(beginID)

    if (sortOrder === "asc" && bID > 0) {
      bID = bID - 1
    } else if (sortOrder === "desc" && bID > 0) {
      bID = bID + 1
    }
    beginID = bID.toString()

    const data = {
      beginID,
      sortOrder,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  }, [sortOrder]);

  // 用户名称搜索逻辑（带防抖）
  React.useEffect(() => {
    if (!searchKeyword || searchKeyword.length < 1) {
      // 关键字为空或长度小于1时恢复原有无限滚动逻辑
      setUsers([]);
      setHasMoreTop(true);
      setHasMoreBottom(true);
      setLocalInitialLoading(true);
      fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() });
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/search?keyword=${encodeURIComponent(searchKeyword)}`);
        const data = await res.json();
        
        if (Array.isArray(data.data)) {
          setUsers(data.data);
          setTotalUsers(data.data.length);
        } else {
          setUsers([]);
          setTotalUsers(0);
        }
        
        setHasMoreTop(false);
        setHasMoreBottom(false);
        setLocalInitialLoading(false);
      } catch (error) {
        console.error("搜索用户失败:", error);
        setUsers([]);
        setTotalUsers(0);
        toast("搜索用户失败");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 监听排序变化，重置缓存并加载初始数据
  React.useEffect(() => {
    setUsers([])
    setHasMoreTop(true)
    setHasMoreBottom(true)
    setLocalInitialLoading(true)
    saveCache((initialCache?.beginID || 0).toString());
    fetchData({ direction: "down", reset: true, customBeginID: (initialCache?.beginID || 0).toString() })
    // eslint-disable-next-line
  }, [sortOrder])

  // 滚动监听
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop === 0 && hasMoreTop && !loadingTop) {
      fetchData({ direction: "up" })
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && hasMoreBottom && !loadingBottom) {
      fetchData({ direction: "down" })
    }
  }

  // 数据请求
  async function fetchData({ direction, reset = false, customBeginID }: { direction: "up" | "down", reset?: boolean, customBeginID?: string }) {
    const pageSize = 20
    let beginID = "0"
    let forward = true
    let asc = sortOrder === "asc"

    if (reset && customBeginID) {
      beginID = customBeginID;
    } else if (!reset && users.length > 0) {
      if (direction === "up") {
        beginID = users[0].id.toString()
        forward = false
      } else {
        beginID = users[users.length - 1].id.toString()
        forward = true
      }
    }

    if (direction === "up") setLoadingTop(true)
    if (direction === "down") setLoadingBottom(true)
    
    try {
      const params = new URLSearchParams()
      params.append("pageSize", String(pageSize))
      params.append("forward", String(forward))
      params.append("asc", String(asc))
      if (beginID !== "0") params.append("beginID", beginID)
      
      const res = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?${params.toString()}`)
      const resp = await res.json()

      let newUsers: User[] = [];
      if (Array.isArray(resp.data)) {
        newUsers = resp.data;
      }

      // 设置总数
      if (resp.meta?.total !== undefined) {
        setTotalUsers(resp.meta.total);
      }

      if (reset) {
        setUsers(newUsers)
        setHasMoreTop(true)
        setHasMoreBottom(true)
        setLocalInitialLoading(false)
        // 缓存第一页的beginID
        if (newUsers.length > 0) {
          saveCache(newUsers[0].id.toString())
        } else {
          saveCache("0")
        }
        return
      }

      if (direction === "up") {
        if (newUsers.length === 0) setHasMoreTop(false)
        setUsers(prev => {
          const merged = [...newUsers, ...prev]
          let mergedUsers = merged.slice(0, 50)
          if (mergedUsers.length > 0) saveCache(mergedUsers[0].id.toString())
          return mergedUsers
        })
      } else {
        if (newUsers.length === 0) setHasMoreBottom(false)
        setUsers(prev => {
          const merged = [...prev, ...newUsers]
          let mergedUsers = merged.slice(-50)
          if (mergedUsers.length > 0) saveCache(mergedUsers[0].id.toString())
          return mergedUsers
        })
      }
    } catch (error) {
      console.error("加载数据失败:", error)
      toast("加载用户列表失败")
    } finally {
      if (direction === "up") setLoadingTop(false)
      if (direction === "down") setLoadingBottom(false)
      setLocalInitialLoading(false)
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
  const handleDeleteUser = async (id: number) => {
    setDeletingId(id)
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`)
      }
      
      setUsers(prev => prev.filter(u => u.id !== id))
      setTotalUsers(prev => prev - 1)
      toast("用户已成功删除")
    } catch (error) {
      console.error("删除用户失败:", error)
      toast("删除用户时出现错误")
    } finally {
      setDeletingId(null)
    }
  }

  // 处理新建用户按钮点击
  const handleNewUserClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 2000) // 2秒冷却时间
  }

  if (localInitialLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">加载中...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">用户列表</h1>
          <p className="text-gray-600">管理系统中的所有用户账号</p>
        </div>

        {/* 操作栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 用户名称搜索栏 */}
            <input
              className="w-48 h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="搜索用户名称"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
            <span className="text-gray-500">或</span>
            <Select value={sortOrder} onValueChange={v => {
                  setSortOrder(v as "asc" | "desc")
                  saveCache("0")
                }}> 
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="排序" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">最新优先</SelectItem>
                    <SelectItem value="asc">最旧优先</SelectItem>
                  </SelectContent>
                </Select>

            {/* 用户统计信息 */}
            <div className="text-sm text-gray-600">
              共 {totalUsers} 个用户
            </div>
            
            {/* 刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUsers([])
                setHasMoreTop(true)
                setHasMoreBottom(true)
                setLocalInitialLoading(true)
                fetchData({ direction: "down", reset: true, customBeginID: "0" })
              }}
            >
              <IconRefresh className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
          
          <Button 
            asChild
            disabled={isButtonCooling}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Link 
              to="/www/admin/create_user" 
              onClick={handleNewUserClick}
              className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
            >
              <IconPlus className="mr-2 h-4 w-4" />
              {isButtonCooling ? "请稍候..." : "创建用户"}
            </Link>
          </Button>
        </div>

        {/* 用户表格 */}
        <div
          ref={scrollRef}
          className="bg-white rounded-lg border shadow-sm overflow-hidden"
          style={{ height: '60vh', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
          onScroll={searchKeyword ? undefined : handleScroll}
        >
          {searchKeyword.length >= 1 && searching && (
            <div className="text-center text-sm text-gray-500 py-4">搜索中...</div>
          )}
          {searchKeyword.length >= 1 && !searching && users.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-4">无匹配用户</div>
          )}
          {loadingTop && <div className="text-center text-sm text-gray-500 py-2">加载中...</div>}
          {!hasMoreTop && <div className="text-center text-sm text-gray-500 py-2">已到顶部</div>}
          
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
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
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <Link 
                        to={`/www/admin/users/${user.id}/edit`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {user.username}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/www/admin/users/${user.id}/edit`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {user.nickname || '-'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/www/admin/users/${user.id}/edit`}
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
                          <Link to={`/www/admin/users/${user.id}/edit`}>
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
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <IconPlus className="h-12 w-12 mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">暂无用户数据</p>
                      <p className="text-sm">点击右上角"创建用户"按钮开始添加用户</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {loadingBottom && <div className="text-center text-sm text-gray-500 py-2">加载中...</div>}
          {!hasMoreBottom && <div className="text-center text-sm text-gray-500 py-2">已到结尾</div>}
        </div>
      </div>
    </AdminLayout>
  )
}
