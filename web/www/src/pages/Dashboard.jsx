import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'

function Dashboard() {
  const { user } = useSelector((state) => state.auth)

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">欢迎回来，{user?.username}！</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">文件管理</h2>
          <p className="text-gray-600 dark:text-gray-300">管理您的文件和目录，上传、下载和组织您的内容。</p>
          <Link to="/files" className="mt-4 inline-block text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
            查看文件 →
          </Link>
        </div>
        
        <div className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">账户信息</h2>
          <div className="mt-2">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">用户名：</span> {user?.username}
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">邮箱：</span> {user?.email}
            </p>
          </div>
        </div>
        
        <div className="bg-primary-50 dark:bg-gray-700 p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">系统状态</h2>
          <p className="text-gray-600 dark:text-gray-300">系统运行正常，所有服务可用。</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard