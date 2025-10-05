import * as React from "react"
import { Plus, Code2 } from "lucide-react"
import { Toaster } from "sonner"
import { Link } from "react-router"

import { LayoutProvider } from "~/components/layout-provider"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { ProgramTable } from "~/components/program-table"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"

interface Program {
  id: string
  name: string
  user_id: string
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  ext?: number
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

  // 删除程序的处理函数
  const handleDeleteProgram = React.useCallback(async (id: string) => {
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/programs/${id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "删除失败")
      }
      
      // 删除成功后，从本地状态中移除
      setPrograms(prev => prev.filter(p => p.id !== id))
    } catch (err: any) {
      throw new Error(err.message || "删除程序时出现错误")
    }
  }, [])

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

  // 监听页面可见性变化，当页面重新获得焦点时刷新程序列表
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPrograms()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadPrograms])

  // 转换程序数据格式以适配 ProgramTable
  const transformedPrograms = React.useMemo(() => {
    return programs.map(program => ({
      id: program.id,
      name: program.name,
      user_id: program.user_id,
      created_at: program.created_at || program.createdAt,
      createdAt: program.created_at || program.createdAt,
      updated_at: program.updated_at || program.updatedAt,
      updatedAt: program.updated_at || program.updatedAt,
      ext: program.ext,
    }))
  }, [programs])

  if (loading) {
    return (
      <LayoutProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-500">加载中...</div>
        </div>
      </LayoutProvider>
    )
  }

  if (error) {
    return (
      <LayoutProvider>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-red-500">{error}</div>
        </div>
      </LayoutProvider>
    )
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
          </div>

          {/* 使用 ProgramTable 组件 */}
          <ProgramTable
            programsData={{
              programs: transformedPrograms,
              users: [],
              total: transformedPrograms.length,
              showForward: false,
              showBackward: false,
              pageSize: 50,
              currentPage: 1,
            }}
            isLoading={loading}
            onDeleteProgram={handleDeleteProgram}
            showUserFilter={false}
            programsApiUrl={`${HOST_URL}/api/programs`}
          />
        </div>
      </div>
      <Toaster />
    </LayoutProvider>
  )
}
