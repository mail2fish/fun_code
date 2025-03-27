import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

// 获取文件列表
export const getFiles = createAsyncThunk(
  'file/getFiles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/files')
      return response.data
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

// 上传文件
export const uploadFile = createAsyncThunk(
  'file/uploadFile',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/files', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

// 创建目录
export const createDirectory = createAsyncThunk(
  'file/createDirectory',
  async (directoryData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/directories', directoryData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

// 删除文件
export const deleteFile = createAsyncThunk(
  'file/deleteFile',
  async (fileId, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/files/${fileId}`)
      return fileId
    } catch (error) {
      return rejectWithValue(error.response.data)
    }
  }
)

const fileSlice = createSlice({
  name: 'file',
  initialState: {
    files: [],
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
      // 获取文件列表状态处理
      .addCase(getFiles.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getFiles.fulfilled, (state, action) => {
        state.isLoading = false
        state.isSuccess = true
        state.files = action.payload
      })
      .addCase(getFiles.rejected, (state, action) => {
        state.isLoading = false
        state.isError = true
        state.message = action.payload?.message || 'Failed to fetch files'
      })
      // 上传文件状态处理
      .addCase(uploadFile.pending, (state) => {
        state.isLoading = true
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        state.isLoading = false
        state.isSuccess = true
        state.files.push(action.payload)
      })
      .addCase(uploadFile.rejected, (state, action) => {
        state.isLoading = false
        state.isError = true
        state.message = action.payload?.message || 'Failed to upload file'
      })
      // 创建目录状态处理
      .addCase(createDirectory.pending, (state) => {
        state.isLoading = true
      })
      .addCase(createDirectory.fulfilled, (state, action) => {
        state.isLoading = false
        state.isSuccess = true
        state.files.push(action.payload)
      })
      .addCase(createDirectory.rejected, (state, action) => {
        state.isLoading = false
        state.isError = true
        state.message = action.payload?.message || 'Failed to create directory'
      })
      // 删除文件状态处理
      .addCase(deleteFile.pending, (state) => {
        state.isLoading = true
      })
      .addCase(deleteFile.fulfilled, (state, action) => {
        state.isLoading = false
        state.isSuccess = true
        state.files = state.files.filter(file => file.id !== action.payload)
      })
      .addCase(deleteFile.rejected, (state, action) => {
        state.isLoading = false
        state.isError = true
        state.message = action.payload?.message || 'Failed to delete file'
      })
  },
})

export const { reset } = fileSlice.actions
export default fileSlice.reducer