import * as React from "react"
import { Share2, Plus, Heart } from "lucide-react"
import { Toaster } from "sonner"

import { LayoutProvider } from "~/components/layout-provider"
import { ShareTable } from "~/components/share-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useUserInfo, useUser } from "~/hooks/use-user"

export default function UserSharePage() {
  const [error, setError] = React.useState<string | null>(null);
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

  const handleDeleteShare = async (id: string) => {
    try {
      const response = await fetchWithAuth(`${HOST_URL}/api/shares/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除分享失败');
      }
    } catch (error) {
      console.error('删除分享失败:', error);
      setError("删除分享失败");
      throw error;
    }
  };

  // 处理新建分享按钮点击
  const handleNewShareClick = (e: React.MouseEvent) => {
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
      title="我的分享作品"
      subtitle="查看和管理你分享的创意作品，与小伙伴们一起欣赏"
    >
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* 我的分享列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Heart className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">我的分享</CardTitle>
                <CardDescription>查看和管理你分享的作品，与小伙伴们一起欣赏</CardDescription>
              </div>
            </div>
            
            {/* 去创建分享按钮 */}
            <Button 
              size="lg"
              disabled={isButtonCooling}
              asChild
              className="fun-button-primary"
            >
              <a 
                href="/www/scratch/projects" 
                onClick={handleNewShareClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <Plus className="mr-2 h-5 w-5" />
                {isButtonCooling ? "跳转中..." : "去创建分享"}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ShareTable 
            sharesApiUrl={`${HOST_URL}/api/shares/user`}
            onDeleteShare={handleDeleteShare}
            showDeleteButton={true}
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