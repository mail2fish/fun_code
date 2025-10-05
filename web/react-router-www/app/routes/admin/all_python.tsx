import * as React from "react"
import { LayoutProvider } from "~/components/layout-provider"
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

interface User {
  id: string
  nickname: string
}

export default function AllPythonProgramsPage() {
  const [programs, setPrograms] = React.useState<Program[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // 删除程序的处理函数
  const handleDeleteProgram = React.useCallback(async (id: string) => {
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/admin/programs/${id}`, {
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

  // 获取程序列表
  const loadPrograms = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetchWithAuth(`${HOST_URL}/api/admin/programs?pageSize=50`)
      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }
      
      const data = await response.json()
      setPrograms(data.data || [])
    } catch (err: any) {
      setError(err.message || "加载程序列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取用户列表
  const loadUsers = React.useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/admin/users/list?pageSize=100`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.data || [])
      }
    } catch (err) {
      console.error("加载用户列表失败:", err)
    }
  }, [])

  React.useEffect(() => {
    loadPrograms()
    loadUsers()
  }, [loadPrograms, loadUsers])

  // 转换程序数据格式以适配 ProjectTable
  const transformedPrograms = React.useMemo(() => {
    return programs.map(program => ({
      id: program.id,
      name: program.name,
      user_id: program.user_id,
      created_at: program.created_at || program.createdAt,
      createdAt: program.created_at || program.createdAt,
    }))
  }, [programs])

  const getExtName = (ext?: number) => {
    switch (ext) {
      case 1: return "Python"
      case 2: return "JavaScript"
      case 3: return "TypeScript"
      case 4: return "Go"
      case 5: return "Java"
      default: return "未知"
    }
  }

  const getExtColor = (ext?: number) => {
    switch (ext) {
      case 1: return "bg-green-100 text-green-800"
      case 2: return "bg-yellow-100 text-yellow-800"
      case 3: return "bg-blue-100 text-blue-800"
      case 4: return "bg-cyan-100 text-cyan-800"
      case 5: return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

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
                <h1 className="text-3xl font-bold text-gray-900">全部Python程序</h1>
                <p className="mt-2 text-gray-600">
                  查看和管理所有用户的编程作品
                </p>
              </div>
            </div>
          </div>

          {/* 使用 ProgramTable 组件 */}
          <ProgramTable
            programsData={{
              programs: transformedPrograms,
              users: users,
              total: transformedPrograms.length,
              showForward: false,
              showBackward: false,
              pageSize: 50,
              currentPage: 1,
            }}
            isLoading={loading}
            onDeleteProgram={handleDeleteProgram}
            showUserFilter={true}
            programsApiUrl={`${HOST_URL}/api/admin/programs`}
          />
        </div>
      </div>
    </LayoutProvider>
  )
}
