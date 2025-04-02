import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import fileReducer from './slices/fileSlice'
import scratchReducer from './slices/scratchSlice'  // Make sure this import is correct

export const store = configureStore({
  reducer: {
    auth: authReducer,
    file: fileReducer,
    scratch: scratchReducer,  // Add this line
  },
})