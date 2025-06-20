import * as React from "react"
import { Globe, Plus, Star, Sparkles } from "lucide-react"
import { Toaster } from "sonner"

import { LayoutProvider } from "~/components/layout-provider"
import { ShareTable } from "~/components/share-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { HOST_URL } from "~/config"
import { useUserInfo, useUser } from "~/hooks/use-user"

export default function AllSharePage() {
  const [isButtonCooling, setIsButtonCooling] = React.useState(false);
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

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
      title="发现精彩分享"
      subtitle="发现小伙伴们的精彩作品，获得创作灵感"
    >
      {/* 全部分享列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Globe className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">全部分享</CardTitle>
                <CardDescription>发现小伙伴们的精彩作品，获得创作灵感</CardDescription>
              </div>
            </div>
            
            {/* 去创建分享按钮 */}
            <Button 
              size="lg"
              disabled={isButtonCooling}
              asChild
              className="fun-button-secondary"
            >
              <a 
                href="/www/scratch/projects" 
                onClick={handleNewShareClick}
                className={isButtonCooling ? "pointer-events-none opacity-70" : ""}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {isButtonCooling ? "跳转中..." : "我也要分享"}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ShareTable 
            sharesApiUrl={`${HOST_URL}/api/shares/all`}
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