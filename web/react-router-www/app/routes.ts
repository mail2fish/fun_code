import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),

    // user
    route("/www/user/dashboard", "routes/user/dashboard.tsx"),
    route("/www/user/my_classes", "routes/user/my_classes.tsx"),
    route("/www/user/class_courses/:classId", "routes/user/class_courses.tsx"),
    route("/www/user/course_lessons/:courseId", "routes/user/course_lessons.tsx"),
    route("/www/scratch/projects", "routes/scratch_projects.tsx"),
    route("/www/scratch/project/:projectId/histories", "routes/scratch_project_histories.tsx"),
    route("/www/files/list", "routes/list_files.tsx"),
    route("/www/shares/user", "routes/user_share.tsx"),
    route("/www/shares/all", "routes/all_share.tsx"),
    route("/www/share/:shareId", "routes/share.tsx"),

    // admin
    route("/www/admin/dashboard", "routes/admin/dashboard.tsx"),
    route("/www/admin/list_users", "routes/admin/list_users.tsx"),
    route("/www/admin/edit_user/:userId", "routes/admin/edit_user.tsx"),
    route("/www/admin/create_user", "routes/admin/create_user.tsx"),
    route("/www/admin/files/upload", "routes/admin/upload_files.tsx"),
    route("/www/admin/create_class", "routes/admin/create_class.tsx"),
    route("/www/admin/list_classes", "routes/admin/list_classes.tsx"),
    route("/www/admin/edit_class/:classId", "routes/admin/edit_class.tsx"),
    route("/www/admin/scratch_projects", "routes/admin/scratch_projects.tsx"),
    
    // course management
    route("/www/admin/list_courses", "routes/admin/list_courses.tsx"),
    route("/www/admin/create_course", "routes/admin/create_course.tsx"),
    route("/www/admin/edit_course/:courseId", "routes/admin/edit_course.tsx"),
    route("/www/admin/course_detail/:courseId", "routes/admin/course_detail.tsx"),
    
    // lesson management
    route("/www/admin/list_lessons", "routes/admin/list_lessons.tsx"),
    route("/www/admin/create_lesson", "routes/admin/create_lesson.tsx"),
    route("/www/admin/edit_lesson/:lessonId", "routes/admin/edit_lesson.tsx"),  

] satisfies RouteConfig;
