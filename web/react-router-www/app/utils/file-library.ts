import CryptoJS from "crypto-js"

import { HOST_URL } from "~/config"
import { fetchWithAuth } from "~/utils/api"

export interface ResourceFile {
  id: number
  name: string
  description: string
  size: number
  tag_id: number
  content_type: number
  original_name: string
}

const ADMIN_UPLOAD_ENDPOINT = `${HOST_URL}/api/admin/files/upload`
const FILE_LIST_ENDPOINT = `${HOST_URL}/api/files/list`
const FILE_SEARCH_ENDPOINT = `${HOST_URL}/api/files/search`

/**
 * 计算文件 SHA1 哈希（兼容 http 环境）
 */
export async function calculateSHA1(file: File): Promise<string> {
  if (window.crypto?.subtle) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest("SHA-1", arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    } catch (error) {
      console.warn("crypto.subtle 不可用，使用 CryptoJS 备用方案:", error)
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer
        const wordArray = CryptoJS.lib.WordArray.create(buffer)
        const hash = CryptoJS.SHA1(wordArray).toString()
        resolve(hash)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsArrayBuffer(file)
  })
}

export interface UploadResourceFileInput {
  file: File
  name?: string
  description?: string
  tagId?: number
  sha1?: string
}

export interface UploadResourceFilesResult {
  successFiles: ResourceFile[]
  successCount: number
  failedFiles: Array<{ file_name: string; error: string }>
  failedCount: number
  totalCount: number
}

/**
 * 上传一个或多个资源文件，返回成功的文件信息
 */
export async function uploadResourceFiles(files: UploadResourceFileInput[]): Promise<UploadResourceFilesResult> {
  if (!files.length) {
    return {
      successFiles: [],
      successCount: 0,
      failedFiles: [],
      failedCount: 0,
      totalCount: 0,
    }
  }

  const formData = new FormData()
  const prepared = await Promise.all(
    files.map(async (item) => {
      const sha1 = item.sha1 || (await calculateSHA1(item.file))
      const defaultDescription = item.file.name.replace(/\.[^/.]+$/, "")
      return {
        file: item.file,
        name: item.name?.trim() || item.file.name,
        description: item.description?.trim() || defaultDescription,
        tagId: Number.isFinite(item.tagId) ? Number(item.tagId) : 0,
        sha1,
      }
    })
  )

  prepared.forEach((item) => {
    formData.append("files", item.file)
  })
  prepared.forEach((item) => {
    formData.append("names", item.name)
    formData.append("descriptions", item.description)
    formData.append("sha1s", item.sha1)
    formData.append("tag_ids", item.tagId.toString())
  })

  const response = await fetchWithAuth(ADMIN_UPLOAD_ENDPOINT, {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `上传文件失败（${response.status}）`)
  }

  const json = await response.json()
  const data = json?.data || json
  const successFiles: ResourceFile[] = data?.success_files || []
  const failedFiles: Array<{ file_name: string; error: string }> = data?.failed_files || []

  return {
    successFiles: Array.isArray(successFiles) ? successFiles : [],
    successCount: typeof data?.success_count === "number" ? data.success_count : successFiles.length,
    failedFiles: Array.isArray(failedFiles) ? failedFiles : [],
    failedCount: typeof data?.failed_count === "number" ? data.failed_count : failedFiles.length,
    totalCount: typeof data?.total_count === "number" ? data.total_count : successFiles.length + failedFiles.length,
  }
}

interface ListResourceFilesOptions {
  pageSize?: number
  beginId?: number
  forward?: boolean
  asc?: boolean
}

/**
 * 获取资源文件列表（默认最多 50 个）
 */
export interface ResourceFileListResult {
  files: ResourceFile[]
  meta?: {
    total?: number
    has_next?: boolean
    begin_id?: number
  }
}

export async function listResourceFiles(options: ListResourceFilesOptions = {}): Promise<ResourceFileListResult> {
  const params = new URLSearchParams()
  params.set("pageSize", String(options.pageSize ?? 50))
  if (typeof options.forward === "boolean") params.set("forward", String(options.forward))
  if (typeof options.asc === "boolean") params.set("asc", String(options.asc))
  if (typeof options.beginId === "number") params.set("beginID", String(options.beginId))

  const response = await fetchWithAuth(`${FILE_LIST_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `获取文件列表失败（${response.status}）`)
  }

  const json = await response.json()
  const data = json?.data || {}
  const files: ResourceFile[] = data?.files || data || []

  return {
    files: Array.isArray(files) ? files : [],
    meta: json?.meta,
  }
}

/**
 * 根据关键字搜索资源文件
 */
export async function searchResourceFiles(keyword: string): Promise<ResourceFileListResult> {
  const trimmed = keyword.trim()
  if (!trimmed) return listResourceFiles()

  const response = await fetchWithAuth(`${FILE_SEARCH_ENDPOINT}?keyword=${encodeURIComponent(trimmed)}`)
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `搜索文件失败（${response.status}）`)
  }

  const json = await response.json()
  const data = json?.data || {}
  const files: ResourceFile[] = data?.files || data || []
  return {
    files: Array.isArray(files) ? files : [],
    meta: json?.meta,
  }
}

