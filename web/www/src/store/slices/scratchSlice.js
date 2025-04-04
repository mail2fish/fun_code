import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

// 获取项目列表
export const getScratchProjects = createAsyncThunk(
  'scratch/getProjects',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/scratch/projects')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

// 删除项目
export const deleteScratchProject = createAsyncThunk(
  'scratch/deleteProject',
  async (projectId, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/scratch/projects/${projectId}`)
      return projectId
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message)
    }
  }
)

const scratchSlice = createSlice({
  name: 'scratch',
  initialState: {
    projects: [],
    isLoading: false,
    isSuccess: false,
    isError: false,
    message: '',
  },
  reducers: {
    reset: (state) => {
      state.isLoading = false
      state.isSuccess = false
      state.isError = false
      state.message = ''
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取项目列表状态处理
      .addCase(getScratchProjects.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getScratchProjects.fulfilled, (state, action) => {
        console.log('API原始返回数据:', action.payload)
        console.log('API返回数据类型:', typeof action.payload)
        console.log('API返回数据结构:', JSON.stringify(action.payload, null, 2))
        
        // 确保数据是数组
        let projectsData = []
        
        if (Array.isArray(action.payload)) {
          projectsData = action.payload
          console.log('数据是数组格式')
        } else if (action.payload && typeof action.payload === 'object') {
          console.log('数据是对象格式，尝试提取数组')
          // 尝试从不同的属性中获取数据
          if (Array.isArray(action.payload.projects)) {
            projectsData = action.payload.projects
            console.log('从payload.projects提取数组')
          } else if (Array.isArray(action.payload.data)) {
            projectsData = action.payload.data
            console.log('从payload.data提取数组')
          } else if (action.payload.result && Array.isArray(action.payload.result)) {
            projectsData = action.payload.result
            console.log('从payload.result提取数组')
          } else {
            // 尝试遍历对象的所有属性，查找数组
            console.log('尝试遍历对象属性查找数组')
            Object.keys(action.payload).forEach(key => {
              if (Array.isArray(action.payload[key])) {
                console.log(`在属性${key}中找到数组`)
                projectsData = action.payload[key]
              }
            })
          }
        }
        
        console.log('处理后的项目数据:', projectsData)
        
        state.projects = projectsData;
        state.isLoading = false;
        state.isSuccess = true;
      })
    .addCase(getScratchProjects.rejected, (state, action) => {
      state.isLoading = false
      state.isError = true
      state.message = action.payload?.error || '获取项目列表失败'
    })
    // 删除项目状态处理
    .addCase(deleteScratchProject.pending, (state) => {
      state.isLoading = true
    })
    .addCase(deleteScratchProject.fulfilled, (state, action) => {
      state.isLoading = false
      state.isSuccess = true
      state.message = '项目已成功删除'
      state.projects = state.projects.filter(project => project.id !== action.payload)
    })
    .addCase(deleteScratchProject.rejected, (state, action) => {
      state.isLoading = false
      state.isError = true
      state.message = action.payload?.error || '删除项目失败'
    })
  },
})

export const { reset } = scratchSlice.actions
// Make sure the default export is at the end of the file
export default scratchSlice.reducer