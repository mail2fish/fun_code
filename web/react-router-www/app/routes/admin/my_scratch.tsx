import { ProjectPage } from "~/components/project-page";
import { HOST_URL } from "~/config";

export default function MyProjectsPage() {
  return (
    <ProjectPage
      title="我的编程项目"
      subtitle="查看和管理你的所有Scratch创意作品，并可创建课件"
      projectsApiUrl={`${HOST_URL}/api/scratch/projects`}
      showUserFilter={false}
      showCreateLessonButton={true}
    />
  );
}
