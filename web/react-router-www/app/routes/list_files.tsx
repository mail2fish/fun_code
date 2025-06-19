import * as React from "react"
import { FileText, Upload } from "lucide-react"
import { Toaster } from "sonner"

import { UserLayout } from "~/components/user-layout"
import { FileTable } from "~/components/file-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

// API 服务
import { HOST_URL } from "~/config"

// 导入用户信息管理
import { useUserInfo, useUser } from "~/hooks/use-user"

export default function ListFilesPage() {
  const [error, setError] = React.useState<string | null>(null)
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo()
  const { logout } = useUser()

  // 处理上传文件按钮点击
  const handleUploadClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault()
      return
    }
    setIsButtonCooling(true)
    setTimeout(() => {
      setIsButtonCooling(false)
    }, 2000)
  }

  return (
    <UserLayout
      userInfo={userInfo || undefined}
      onLogout={logout}
    >
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 文件列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">文件列表</CardTitle>
                <CardDescription>查看和管理你的所有文件资源</CardDescription>
              </div>
            </div>
            
            {/* 上传文件按钮 */}
            <Button 
              size="lg"
              disabled={isButtonCooling}
              asChild
              className="fun-button-primary"
            >
              <a 
                href="/www/upload" 
                onClick={handleUploadClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <Upload className="mr-2 h-5 w-5" />
                {isButtonCooling ? "上传中..." : "上传文件"}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FileTable 
            filesApiUrl={`${HOST_URL}/api/files/list`}
            downloadApiUrl="/api/files/{fileId}/download"
            showDeleteButton={false}
          />
        </CardContent>
      </Card>

      {/* Toast 通知 */}
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
    </UserLayout>
  )
} 