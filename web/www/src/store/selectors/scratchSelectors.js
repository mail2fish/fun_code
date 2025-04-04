import { createSelector } from '@reduxjs/toolkit'

// 创建常量空对象和空数组避免创建新引用
const EMPTY_OBJECT = {}
const EMPTY_ARRAY = []

// 基础选择器 - 直接返回state.scratch，不创建新对象
const selectScratchState = state => state.scratch || EMPTY_OBJECT

// 记忆化的选择器
export const selectScratchProjects = createSelector(
  selectScratchState,
  scratch => scratch.projects || EMPTY_ARRAY
)

export const selectScratchLoading = createSelector(
  selectScratchState,
  scratch => Boolean(scratch.isLoading)
)

export const selectScratchSuccess = createSelector(
  selectScratchState,
  scratch => Boolean(scratch.isSuccess)
)

export const selectScratchError = createSelector(
  selectScratchState,
  scratch => Boolean(scratch.isError)
)

export const selectScratchMessage = createSelector(
  selectScratchState,
  scratch => scratch.message || ''
)