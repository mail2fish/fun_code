import { ProjectPage } from "~/components/project-page";
import { HOST_URL } from "~/config";

export default function AllProjectsPage() {
  return (
    <ProjectPage
      title="全部编程项目"
      subtitle="查看和管理所有用户的Scratch创意作品"
      projectsApiUrl={`${HOST_URL}/api/admin/scratch/projects`}
      showUserFilter={true}
      showCreateLessonButton={true}
    />
  );
}
