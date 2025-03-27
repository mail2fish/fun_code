import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getFiles, uploadFile, deleteFile, createDirectory, reset } from '../store/slices/fileSlice'

function FileManager() {
  const [file, setFile] = useState(null)
  const [directoryName, setDirectoryName] = useState('')
  const [showCreateDirForm, setShowCreateDirForm] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const dispatch = useDispatch()
  const { files, isLoading, isSuccess, isError, message } = useSelector(
    (state) => state.file
  )

  useEffect(() => {
    dispatch(getFiles())

    return () => {
      dispatch(reset())
    }
  }, [])

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

  const onFileChange = (e) => {
    setFile(e.target.files[0])
  }

  const onFileUpload = (e) => {
    e.preventDefault()
    if (!file) {
      setError('请选择一个文件')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    dispatch(uploadFile(formData))
    setFile(null)
    // 重置文件输入
    e.target.reset()
  }

  const onCreateDirectory = (e) => {
    e.preventDefault()
    if (!directoryName.trim()) {
      setError('请输入目录名称')
      return
    }

    dispatch(createDirectory({ name: directoryName }))
    setDirectoryName('')
    setShowCreateDirForm(false)
  }

  const onDeleteFile = (id) => {
    if (window.confirm('确定要删除这个文件吗？')) {
      dispatch(deleteFile(id))
    }
  }

  const downloadFile = (id, filename) => {
    // 创建一个隐藏的a标签来触发下载
    const a = document.createElement('a')
    a.href = `/api/files/${id}`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    try {
      // 移除毫秒后的小数部分，因为 JS Date 对象无法正确处理这种格式
      const cleanDateString = dateString.replace(/\.\d+/, '')
      const date = new Date(cleanDateString)
      
      if (isNaN(date.getTime())) {
        console.error('无效日期:', dateString)
        return '未知日期'
      }
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch (error) {
      console.error('日期格式化错误:', error)
      return '日期格式错误'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">文件管理</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateDirForm(!showCreateDirForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            创建目录
          </button>
          <form onSubmit={onFileUpload} className="flex items-center">
            <input
              type="file"
              onChange={onFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded cursor-pointer mr-2"
            >
              选择文件
            </label>
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={!file}
            >
              上传
            </button>
          </form>
        </div>
      </div>

      {showCreateDirForm && (
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded">
          <form onSubmit={onCreateDirectory} className="flex items-center">
            <input
              type="text"
              value={directoryName}
              onChange={(e) => setDirectoryName(e.target.value)}
              placeholder="目录名称"
              className="flex-grow mr-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => setShowCreateDirForm(false)}
              className="ml-2 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              取消
            </button>
          </form>
        </div>
      )}

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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  名称
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  类型
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  大小
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
              {files.length > 0 ? (
                files.map((file) => (
                  <tr key={file.ID}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {file.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        {file.is_directory ? '目录' : '文件'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        {file.is_directory ? '-' : formatFileSize(file.size)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-300">
                        {formatDate(file.CreatedAt)}  {/* 已修改：从 created_at 改为 CreatedAt */}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!file.is_directory && (
                        <button
                          onClick={() => downloadFile(file.ID, file.name)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-3"
                        >
                          下载
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteFile(file.ID)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))  // 确保这里有一个右括号
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                    没有文件或目录
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

export default FileManager