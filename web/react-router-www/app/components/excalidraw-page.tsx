import * as React from "react"
import { Plus, Palette, Rocket } from "lucide-react"
import { Toaster } from "sonner"

import { LayoutProvider } from "~/components/layout-provider"
import { ExcalidrawTable } from "~/components/excalidraw-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

// 导入自定义的 fetch 函数
import { fetchWithAuth } from "~/utils/api";

// API 服务
import { HOST_URL } from "~/config";

// 导入用户信息管理
import { useUserInfo, useUser } from "~/hooks/use-user";

// 删除 Excalidraw 流程图
async function deleteExcalidrawBoard(id: string) {
  console.log("删除流程图", id);
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/excalidraw/boards/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除流程图失败:", error);
    throw error;
  }
}

interface ExcalidrawPageProps {
  title: string;
  subtitle: string;
}

export function ExcalidrawPage({ 
  title, 
  subtitle
}: ExcalidrawPageProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

  // 处理删除流程图
  const handleDeleteBoard = async (id: string) => {
    try {
      await deleteExcalidrawBoard(id);
      // 删除成功后重新加载当前页
      console.log("删除成功后重新加载当前页");
    } catch (error) {
      setError("删除流程图失败");
      throw error;
    }
  };

  // 处理新建流程图按钮点击
  const handleNewBoardClick = (e: React.MouseEvent) => {
    if (isButtonCooling) {
      e.preventDefault();
      return;
    }
    setIsButtonCooling(true);
    setTimeout(() => {
      setIsButtonCooling(false);
    }, 2000);
  };

  return (
    <LayoutProvider
      title={title}
      subtitle={subtitle}
    >
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 流程图列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Palette className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">流程图列表</CardTitle>
                <CardDescription>查看和管理你的所有Excalidraw创意作品</CardDescription>
              </div>
            </div>
            
            {/* 新建流程图按钮 */}
            <Button 
              size="lg"
              disabled={isButtonCooling}
              asChild
              className="fun-button-primary"
            >
              <a 
                href={`${HOST_URL}/excalidraw/new`} 
                onClick={handleNewBoardClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <Plus className="mr-2 h-5 w-5" />
                {isButtonCooling ? "创建中..." : "新建流程图"}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ExcalidrawTable 
            onDeleteBoard={handleDeleteBoard}
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
