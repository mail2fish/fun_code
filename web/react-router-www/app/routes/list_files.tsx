import * as React from "react"
import { FileText, Upload } from "lucide-react"
import { Toaster } from "sonner"

import { LayoutProvider } from "~/components/layout-provider"
import { FileTable } from "~/components/file-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

// API 服务
import { HOST_URL } from "~/config"

// 导入用户信息管理
import { useUserInfo, useUser } from "~/hooks/use-user"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api"

// 删除文件
async function deleteFile(id: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/files/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除文件失败:", error);
    throw error;
  }
}

export default function ListFilesPage() {
  const [error, setError] = React.useState<string | null>(null)
  const [isButtonCooling, setIsButtonCooling] = React.useState(false)
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo()
  const { logout } = useUser()

  // 处理删除文件
  const handleDeleteFile = async (id: string) => {
    try {
      await deleteFile(id);
      // 删除成功后，FileTable会自动刷新
    } catch (error) {
      setError("删除文件失败");
      throw error;
    }
  };

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

  // 判断是否为管理员
  const isAdmin = userInfo?.role === "管理员"

  return (
    <LayoutProvider
      title="文件资源"
      subtitle="查看和管理你的所有文件资源"
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
              <FileText className="w-6 h-6 text-fuchsia-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">文件列表</CardTitle>
                <CardDescription>查看和管理你的所有文件资源</CardDescription>
              </div>
            </div>
            
            {/* 上传文件按钮 - 仅管理员可见 */}
            {isAdmin && (
              <Button 
                size="lg"
                disabled={isButtonCooling}
                asChild
                className="fun-button-primary"
              >
                <a 
                  href="/www/admin/files/upload" 
                  onClick={handleUploadClick}
                  className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
                >
                  <Upload className="mr-2 h-5 w-5" />
                  {isButtonCooling ? "上传中..." : "上传文件"}
                </a>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <FileTable 
            onDeleteFile={isAdmin ? handleDeleteFile : undefined}
            filesApiUrl={`${HOST_URL}/api/files/list`}
            downloadApiUrl="/api/files/{fileId}/download"
            showDeleteButton={isAdmin}
          />
        </CardContent>
      </Card>

      {/* Toast 通知 */}
      <Toaster 
        position="top-right"
        theme="light"
        richColors
      />
    </LayoutProvider>
  )
} 