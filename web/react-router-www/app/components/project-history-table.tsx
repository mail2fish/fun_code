import * as React from "react"
import { Button } from "~/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { IconDownload } from "@tabler/icons-react"
import { HOST_URL } from "~/config"

export interface ProjectHistory {
  filename: string
  created_at: string
}

export interface ProjectHistoriesData {
  project_id: string
  name: string
  histories: ProjectHistory[]
  created_at: string
  updated_at: string
}

interface ProjectHistoryTableProps {
  historiesData: ProjectHistoriesData
  isLoading: boolean
}

export function ProjectHistoryTable({
  historiesData,
  isLoading,
}: ProjectHistoryTableProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "未知日期"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return "未知日期"
      }
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      })
    } catch (error) {
      return "日期格式错误"
    }
  }

  if (isLoading) {
    return <div className="text-center py-4">加载中...</div>
  }

  const histories = historiesData.histories || []

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl overflow-hidden border">        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>历史文件名</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(histories) && histories.length > 0 ? (
              histories.map((history, idx) => (
                <TableRow key={history.filename || idx}>
                  <TableCell className="break-all max-w-xs">
                    <a href={`${HOST_URL}/projects/scratch/open/${history.filename}`} className="text-blue-500 hover:text-blue-600" >
                      {history.filename}
                      </a>
                  </TableCell>
                  <TableCell>{formatDate(history.created_at)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  没有找到历史记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 