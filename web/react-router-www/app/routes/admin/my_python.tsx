import * as React from "react"
import { Plus, Code2, Calendar, User, Trash2, Edit } from "lucide-react"
import { Toaster } from "sonner"
import { Link } from "react-router"

import { LayoutProvider } from "~/components/layout-provider"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { fetchWithAuth, formatDate } from "~/utils/api"
import { HOST_URL } from "~/config"

interface Program {
  id: number
  name: string
  ext: number
  created_at: string
  updated_at: string
  user_id: number
}

interface ProgramsResponse {
  data: Program[]
  meta: {
    total: number
    hasNext: boolean
  }
}

export default function AdminMyPythonProgramsPage() {
  const [programs, setPrograms] = React.useState<Program[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [total, setTotal] = React.useState(0)

  const loadPrograms = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetchWithAuth(`${HOST_URL}/api/programs?pageSize=50`)
      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }
      
      const data: ProgramsResponse = await response.json()
      setPrograms(data.data || [])
      setTotal(data.meta?.total || 0)
    } catch (err: any) {
      setError(err.message || "加载程序列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadPrograms()
  }, [loadPrograms])

  const getExtName = (ext: number) => {
    switch (ext) {
      case 1: return "Python"
      case 2: return "JavaScript"
      case 3: return "TypeScript"
      case 4: return "Go"
      case 5: return "Java"
      default: return "未知"
    }
  }

  const getExtColor = (ext: number) => {
    switch (ext) {
      case 1: return "bg-green-100 text-green-800"
      case 2: return "bg-yellow-100 text-yellow-800"
      case 3: return "bg-blue-100 text-blue-800"
      case 4: return "bg-cyan-100 text-cyan-800"
      case 5: return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <LayoutProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* 页面头部 */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">我的Python程序</h1>
                <p className="mt-2 text-gray-600">
                  管理员视角 - 查看和管理你的所有编程作品
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/www/user/programs/new">
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    创建新程序
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总程序数</CardTitle>
                <Code2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Python程序</CardTitle>
                <Code2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {programs.filter(p => p.ext === 1).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">JavaScript</CardTitle>
                <Code2 className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {programs.filter(p => p.ext === 2).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">其他语言</CardTitle>
                <Code2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {programs.filter(p => p.ext !== 1 && p.ext !== 2).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 程序列表 */}
          <Card>
            <CardHeader>
              <CardTitle>程序列表</CardTitle>
              <CardDescription>
                管理员可以查看、编辑和删除所有程序
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">加载中...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-red-500">{error}</div>
                </div>
              ) : programs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Code2 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">还没有程序</h3>
                  <p className="text-gray-500 mb-4">创建你的第一个程序开始编程之旅</p>
                  <Link to="/www/user/programs/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      创建程序
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {programs.map((program) => (
                    <div
                      key={program.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Code2 className="h-8 w-8 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/www/user/programs/open/${program.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {program.name}
                          </Link>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getExtColor(program.ext)}`}>
                              {getExtName(program.ext)}
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(program.updated_at)}
                            </span>
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              ID: {program.user_id}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link to={`/www/user/programs/open/${program.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3 mr-1" />
                            编辑
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-3 w-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </LayoutProvider>
  )
}
