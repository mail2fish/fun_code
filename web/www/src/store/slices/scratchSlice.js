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
        state.isLoading = false
        state.isSuccess = true
        state.projects = action.payload
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