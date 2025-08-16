import { ProjectPage } from "~/components/project-page";
import { HOST_URL } from "~/config";

// 删除 Excalidraw 画板
async function deleteExcalidrawBoard(id: string) {
  console.log("删除画板", id);
  try {
    const response = await fetch(`${HOST_URL}/api/excalidraw/boards/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("删除画板失败:", error);
    throw error;
  }
}

export default function ExcalidrawProjectsPage() {
  return (
    <ProjectPage
      title="我的流程图"
      subtitle="查看和管理你的所有Excalidraw创意作品"
      projectsApiUrl={`${HOST_URL}/api/excalidraw/boards`}
      showUserFilter={false}
      showCreateLessonButton={false}
      onDeleteProject={deleteExcalidrawBoard}
      showCreateButton={true}
      createButtonText="新建流程图"
      createButtonUrl={`${HOST_URL}/excalidraw`}
    />
  );
}
