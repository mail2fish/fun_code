import * as React from "react"
import { Link } from "react-router"
import { IconEdit, IconTrash } from "@tabler/icons-react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { toast } from  "sonner" 

import { API_BASE_URL } from "~/config";


export interface Project {
  id: string
  name: string
  created_at?: string
  createdAt?: string
}

interface ProjectTableProps {
  projects: Project[]
  isLoading: boolean
  onDeleteProject: (id: string) => Promise<void>
}

export function ProjectTable({ projects, isLoading, onDeleteProject }: ProjectTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

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

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDeleteProject(id)
      toast("项目已成功删除")
    } catch (error) {
        toast("删除项目时出现错误")      
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <div className="text-center py-4">加载中...</div>
  }

  return (
    <div className="rounded-xl overflow-hidden border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>项目名称</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="w-[150px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.isArray(projects) && projects.length > 0 ? (
            projects.map((project) => (
              <TableRow key={project.id || Math.random()}>
                <TableCell className="font-medium">
                  {project.name || "未命名项目"}
                </TableCell>
                <TableCell>
                  {formatDate(project.created_at || project.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="编辑"
                      asChild
                    >
                      <Link to={`${API_BASE_URL}/projects/scratch/${project.id}`} target="_blank">
                        <IconEdit className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="删除">
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认删除</DialogTitle>
                          <DialogDescription>
                            您确定要删除项目 "{project.name}" 吗？此操作无法撤销。
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">取消</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => handleDelete(project.id)}
                            disabled={deletingId === project.id}
                          >
                            {deletingId === project.id ? "删除中..." : "删除"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center">
                没有找到 Scratch 项目
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}