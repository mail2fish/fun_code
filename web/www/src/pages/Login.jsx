import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { login, reset, setCredentials } from '../store/slices/authSlice'
import { prefix } from '../config'

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')

  const { username, password } = formData
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { user, isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.auth
  )

  useEffect(() => {
    // 调试信息
    console.log('登录状态变化:', { isSuccess, isError, user });

    // 登录成功后重定向到仪表盘，确保用户数据存在
    if (isSuccess && user) {
      console.log('准备跳转到 dashboard');
      navigate('/dashboard');
    } else if (isSuccess) {
      // 登录成功但没有用户数据，可能是API返回格式问题
      console.log('登录成功但用户数据缺失，检查API返回格式');
      // 尝试直接使用setCredentials设置用户信息
      dispatch(setCredentials({ 
        user: { username: formData.username },
        token: localStorage.getItem('token')
      }));
    }

    if (isError) {
      setError(message);
    }

    // 只在组件卸载时重置状态，避免循环
    return () => {
      if (isSuccess || isError) {
        dispatch(reset());
      }
    };
  }, [user, isError, isSuccess, message, navigate, dispatch, formData]);

  const onChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }))
  }

  const onSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('请填写所有字段')
      return
    }

    const userData = {
      username,
      password,
    }

    dispatch(login(userData))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            登录您的账户
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="relative block w-full rounded-t-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                placeholder="用户名"
                value={username}
                onChange={onChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                placeholder="密码"
                value={password}
                onChange={onChange}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md bg-primary-600 py-2 px-3 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:bg-primary-300"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>

          <div className="text-sm text-center">
            <span className="text-gray-500 dark:text-gray-400">还没有账户？</span>{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              注册
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login