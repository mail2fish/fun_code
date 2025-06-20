import * as React from "react"
import { useParams } from "react-router"
import { Calendar, User, Eye, Heart, Clock } from "lucide-react"

import { LayoutProvider } from "~/components/layout-provider"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { HOST_URL } from "~/config"
import { useUserInfo, useUser } from "~/hooks/use-user"

interface ShareData {
  share_token: string
  project_id: number
  title: string
  description: string
  nick_name: string
  created_at: string
  updated_at: string
  view_count: number
  like_count: number
}

export default function SharePage() {
  const { shareId } = useParams()
  const [shareData, setShareData] = React.useState<ShareData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  // 用户信息管理
  const { userInfo } = useUserInfo()
  const { logout } = useUser()

  // 获取分享数据
  React.useEffect(() => {
    if (!shareId) return
    
    const fetchShareData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${HOST_URL}/api/shares/info/${shareId}`)
        if (!response.ok) {
          throw new Error('获取分享数据失败')
        }
        const result = await response.json()
        setShareData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取分享数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchShareData()
  }, [shareId])

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '未知时间'
    }
  }

  if (loading) {
    return (
      <LayoutProvider showBackgroundPattern={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </LayoutProvider>
    )
  }

  if (error || !shareData) {
    return (
      <LayoutProvider showBackgroundPattern={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4">😔 {error || '分享不存在'}</p>
            <Button 
              onClick={() => window.history.back()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              返回上一页
            </Button>
          </div>
        </div>
      </LayoutProvider>
    )
  }

  return (
    <LayoutProvider 
      title={shareData.title || 'Scratch作品'}
      subtitle={shareData.description || '这是一个精彩的 Scratch 创意作品！'}
      showBackgroundPattern={false}
      showNavigation={!!userInfo}
    >
      {/* 主要内容区域 */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* 左右布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 左侧：作者信息 */}
            <div className="lg:col-span-4">
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2 text-purple-700">
                    <User className="w-5 h-5" />
                    作者信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 作者头像和名字 */}
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                      {shareData.nick_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {shareData.nick_name || '未知作者'}
                    </h3>
                  </div>

                  {/* 统计信息 */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-3 text-gray-600">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">浏览次数</span>
                      <span className="ml-auto font-semibold">{shareData.view_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm">喜欢次数</span>
                      <span className="ml-auto font-semibold">{shareData.like_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <Calendar className="w-4 h-4 text-green-500" />
                      <span className="text-sm">创建时间</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-7">
                      {formatDate(shareData.created_at)}
                    </p>
                    {shareData.updated_at !== shareData.created_at && (
                      <>
                        <div className="flex items-center gap-3 text-gray-600">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="text-sm">更新时间</span>
                        </div>
                        <p className="text-xs text-gray-500 ml-7">
                          {formatDate(shareData.updated_at)}
                        </p>
                      </>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="pt-4 border-t space-y-2">
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      onClick={() => {
                        // TODO: 实现点赞功能
                        console.log('点赞功能待实现')
                      }}
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      给作品点赞
                    </Button>
                    {userInfo && (
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          // 返回分享列表
                          window.location.href = '/www/shares/all'
                        }}
                      >
                        返回分享列表
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：程序预览 */}
            <div className="lg:col-span-8">
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-center text-purple-700">
                    🎮 程序预览
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                    <iframe
                      src={`${HOST_URL}/shares/${shareId}`}
                      className="w-full h-[410px] border-0"
                      title={shareData.title || 'Scratch作品'}
                      allowFullScreen
                    />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      项目ID: {shareData.project_id} | Token: {shareData.share_token}
                    </p>
                    <Button 
                      onClick={() => window.open(`${HOST_URL}/shares/${shareId}`, '_blank')}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      在新窗口中打开
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* 精美页脚 */}
      <footer className="mt-16 py-8 bg-gradient-to-r from-purple-100 to-pink-100">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm">
            ✨ 感谢您查看这个精彩的 Scratch 作品！ ✨
          </p>
          <p className="text-gray-500 text-xs mt-2">
            让我们一起在创意的世界中探索无限可能
          </p>
        </div>
      </footer>
    </LayoutProvider>
  )
} 