import * as React from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, History, Sparkles, Calendar, Clock, Rocket } from "lucide-react"
import { Toaster } from "sonner"

import { UserLayout } from "~/components/user-layout"
import { ProjectHistoryTable, type ProjectHistoriesData } from "~/components/project-history-table"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { fetchWithAuth } from "~/utils/api"
import { HOST_URL } from "~/config"
import { useUserInfo, useUser } from "~/hooks/use-user"

// 获取程序历史记录列表
async function getScratchProjectHistories(projectId: string) {
  try {
    const response = await fetchWithAuth(`${HOST_URL}/api/scratch/projects/${projectId}/histories`);
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("获取程序历史记录失败:", error);
    throw error;
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return "未知时间";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "未知时间";
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  } catch {
    return "时间格式错误";
  }
}

export default function ScratchProjectHistories() {
  const [historiesData, setHistoriesData] = React.useState<ProjectHistoriesData>({
    project_id: "",
    name: "",
    histories: [],
    updated_at: "",
    created_at: "",
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { projectId } = useParams();
  
  // 使用统一的用户信息管理
  const { userInfo } = useUserInfo();
  const { logout } = useUser();

  React.useEffect(() => {
    if (projectId) {
      getScratchProjectHistories(projectId)
        .then(response => {
          setHistoriesData({
            project_id: response.data.project_id,
            name: response.data.name,
            histories: response.data.histories || [],
            updated_at: response.data.updated_at,
            created_at: response.data.created_at,
          });
          setError(null);
        })
        .catch(() => setError("加载程序历史记录失败"))
        .finally(() => setIsLoading(false));
    }
  }, [projectId]);

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

      {/* 历史记录列表 */}
      <Card className="fun-card border-gray-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <History className="w-6 h-6 text-purple-600" />
              <div>
                <CardTitle className="text-xl text-gray-800">
                  {historiesData.name ? `${historiesData.name} - 历史记录` : "程序历史记录"}
                </CardTitle>
                <CardDescription>查看程序的修改历史和版本变化</CardDescription>
              </div>
            </div>
            
            {/* 返回按钮 */}
            <Button 
              size="lg"
              onClick={() => window.history.back()}
              className="fun-button-secondary gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回程序列表
            </Button>
          </div>

          {/* 程序基本信息 */}
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <div className="flex items-start gap-4">
              {/* 程序缩略图 */}
              <div className="flex-shrink-0">
                <div className="h-20 w-20 overflow-hidden rounded-lg border-2 border-purple-200 bg-white shadow-sm">
                  {projectId ? (
                    <img 
                      src={`${HOST_URL}/api/scratch/projects/${projectId}/thumbnail`} 
                      alt="程序缩略图" 
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/images/scratch-default-thumbnail.png";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-purple-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* 程序信息 */}
              <div className="flex-1 min-w-0">
                <div className="space-y-2">
                  {historiesData.project_id && (
                    <div className="flex items-center gap-2 text-sm">
                      <Rocket className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span className="font-medium text-gray-600">程序ID:</span>
                      <span className="text-gray-800 font-mono">{historiesData.project_id}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {historiesData.created_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="font-medium text-gray-600">创建:</span>
                        <span className="text-gray-700">{formatDate(historiesData.created_at)}</span>
                      </div>
                    )}
                    
                    {historiesData.updated_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="font-medium text-gray-600">更新:</span>
                        <span className="text-gray-700">{formatDate(historiesData.updated_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <ProjectHistoryTable
            historiesData={historiesData}
            isLoading={isLoading}
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
  );
} 