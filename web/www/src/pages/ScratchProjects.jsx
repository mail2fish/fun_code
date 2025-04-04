import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getScratchProjects, deleteScratchProject, reset } from '../store/slices/scratchSlice'
import { store } from '../store/store' // 添加这一行导入store
import { 
  selectScratchProjects, 
  selectScratchLoading, 
  selectScratchSuccess, 
  selectScratchError, 
  selectScratchMessage 
} from '../store/selectors/scratchSelectors'

function ScratchProjects() {
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const dispatch = useDispatch()
  
  // 使用记忆化的选择器
  const projects = useSelector(selectScratchProjects)
  const isLoading = useSelector(selectScratchLoading)
  const isSuccess = useSelector(selectScratchSuccess)
  const isError = useSelector(selectScratchError)
  const message = useSelector(selectScratchMessage)

  // 添加一个函数来直接检查Redux状态
  const checkReduxState = () => {
    // 获取完整的Redux状态
    const state = store.getState();
    console.log('完整Redux状态:', state);
    console.log('Scratch切片状态:', state.scratch);
  }

  useEffect(() => {
    dispatch(getScratchProjects())
    
    // 添加调试代码，查看Redux状态
    console.log('初始化获取项目列表')
    
    // 延迟检查Redux状态
    setTimeout(() => {
      console.log('延迟检查Redux状态:');
      checkReduxState();
    }, 2000);

    return () => {
      dispatch(reset())
    }
  }, [dispatch])

  // 添加调试代码，查看projects数据
  useEffect(() => {
    console.log('当前项目数据:', projects)
  }, [projects])

  useEffect(() => {
    if (isError) {
      setError(message)
      setTimeout(() => setError(''), 5000)
    }

    if (isSuccess && message) {
      setSuccessMessage(message)
      setTimeout(() => setSuccessMessage(''), 5000)
    }

    dispatch(reset())
  }, [isError, isSuccess, message, dispatch])

  const onDeleteProject = (id) => {
    if (window.confirm('确定要删除这个项目吗？')) {
      dispatch(deleteScratchProject(id))
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      
      if (isNaN(date.getTime())) {
        return '未知日期'
      }
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch (error) {
      return '日期格式错误'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">我的 Scratch 项目</h1>
        <button
          onClick={() => window.open('/scratch', '_blank')}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          创建新项目
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4">加载中...</div>
      ) : (
        <div className="overflow-x-auto">
          {/* 添加调试信息 */}
          {projects && projects.length === 0 && (
            <div className="text-center py-2 text-gray-500">
              API返回了空数据或数据格式不正确
            </div>
          )}
          
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  项目名称
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  创建时间
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(projects) && projects.length > 0 ? (
                projects.map((project) => {
                  console.log('渲染项目:', project) // 添加调试信息
                  return (
                    <tr key={project.id || Math.random()}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {project.name || '未命名项目'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-300">
                          {formatDate(project.created_at || project.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => window.open(`/scratch#${project.id}`, '_blank')}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-3"
                        >
                          打开
                        </button>
                        <button
                          onClick={() => onDeleteProject(project.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                    没有 Scratch 项目
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ScratchProjects