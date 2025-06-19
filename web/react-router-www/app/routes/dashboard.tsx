import { useState, useEffect } from "react";
import { Link } from "react-router";
import { UserLayout } from "~/components/user-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { 
  Blocks, 
  Users, 
  Share2, 
  FileText, 
  PlusCircle, 
  Clock,
  Star,
  Zap,
  Trophy,
  Rocket
} from "lucide-react";

// 模拟用户数据
const mockUserInfo = {
  name: "小明",
  role: "学生"
};

// 模拟统计数据
const mockStats = {
  projects: 8,
  classes: 3,
  shares: 5,
  files: 12
};

// 模拟最近项目数据
const mockRecentProjects = [
  { id: 1, name: "我的第一个游戏", lastModified: "2小时前", thumbnail: "🎮" },
  { id: 2, name: "彩虹画笔", lastModified: "1天前", thumbnail: "🌈" },
  { id: 3, name: "小猫历险记", lastModified: "3天前", thumbnail: "🐱" },
  { id: 4, name: "数字猜谜", lastModified: "1周前", thumbnail: "🔢" }
];

// 模拟成就数据
const mockAchievements = [
  { icon: "🏆", name: "编程新手", description: "完成第一个项目" },
  { icon: "⭐", name: "创意达人", description: "创建5个项目" },
  { icon: "🚀", name: "分享达人", description: "分享3个作品" }
];

export default function Dashboard() {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <UserLayout
      userInfo={mockUserInfo}
      onLogout={handleLogout}
      title="欢迎回来，小明！"
      subtitle="今天想创造什么有趣的项目呢？"
    >
      {/* 快速操作区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link to="/www/scratch/projects">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-purple-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Blocks className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的项目</h3>
              <p className="text-gray-600 text-sm mb-3">创建和管理你的Scratch项目</p>
              <div className="text-2xl font-bold text-purple-600">{mockStats.projects}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/www/classes/list">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的班级</h3>
              <p className="text-gray-600 text-sm mb-3">查看班级信息和课程</p>
              <div className="text-2xl font-bold text-blue-600">{mockStats.classes}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/www/shares/user">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-green-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的分享</h3>
              <p className="text-gray-600 text-sm mb-3">管理你分享的作品</p>
              <div className="text-2xl font-bold text-green-600">{mockStats.shares}</div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/www/files/list">
          <Card className="fun-card hover:scale-105 transition-all duration-300 cursor-pointer group border-orange-200">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform duration-300">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-gray-800 mb-2">我的文件</h3>
              <p className="text-gray-600 text-sm mb-3">管理上传的文件资源</p>
              <div className="text-2xl font-bold text-orange-600">{mockStats.files}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 最近项目 */}
        <div className="lg:col-span-2">
          <Card className="fun-card border-purple-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <CardTitle className="text-xl text-gray-800">最近项目</CardTitle>
                </div>
                <Link to="/www/scratch/projects">
                  <Button variant="outline" size="sm" className="rounded-full">
                    查看全部
                  </Button>
                </Link>
              </div>
              <CardDescription>继续你未完成的创作吧！</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockRecentProjects.map((project) => (
                  <Card key={project.id} className="border border-gray-200 hover:shadow-md transition-shadow duration-300 cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{project.thumbnail}</div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800">{project.name}</h4>
                          <p className="text-sm text-gray-500">{project.lastModified}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-6">
                <Link to="/www/scratch/projects">
                  <Button className="w-full fun-button-primary">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    创建新项目
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 成就卡片 */}
          <Card className="fun-card border-yellow-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-600" />
                <CardTitle className="text-lg text-gray-800">我的成就</CardTitle>
              </div>
              <CardDescription>你已经很棒了！</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAchievements.map((achievement, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 text-sm">{achievement.name}</h4>
                      <p className="text-xs text-gray-600">{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 快速链接 */}
          <Card className="fun-card border-blue-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-blue-600" />
                <CardTitle className="text-lg text-gray-800">快速开始</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/www/scratch/projects">
                <Button variant="outline" className="w-full rounded-xl justify-start">
                  <Rocket className="w-4 h-4 mr-2" />
                  开始新项目
                </Button>
              </Link>
              <Link to="/www/shares/all">
                <Button variant="outline" className="w-full rounded-xl justify-start">
                  <Star className="w-4 h-4 mr-2" />
                  浏览其他作品
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </UserLayout>
  );
}
