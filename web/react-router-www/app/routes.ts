import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),

    // user
    route("/www/user/dashboard", "routes/user/dashboard.tsx"),
    route("/www/scratch_projects", "routes/scratch_projects.tsx"),
    route("/www/scratch_project_histories", "routes/scratch_project_histories.tsx"),
    route("/www/list_files", "routes/list_files.tsx"),
    route("/www/user_share", "routes/user_share.tsx"),
    route("/www/all_share", "routes/all_share.tsx"),
    route("/www/share/:shareId", "routes/share.tsx"),

    // admin
    route("/www/admin/dashboard", "routes/admin/dashboard.tsx"),
    route("/www/admin/list_users", "routes/admin/list_users.tsx"),
    route("/www/admin/edit_user/:userId", "routes/admin/edit_user.tsx"),
    route("/www/admin/create_user", "routes/admin/create_user.tsx"),
    route("/www/admin/upload_files", "routes/admin/upload_files.tsx"),
    route("/www/admin/create_class", "routes/admin/create_class.tsx"),
    route("/www/admin/list_classes", "routes/admin/list_classes.tsx"),
    route("/www/admin/edit_class/:classId", "routes/admin/edit_class.tsx"),
    
    // course management
    route("/www/admin/list_courses", "routes/admin/list_courses.tsx"),
    route("/www/admin/create_course", "routes/admin/create_course.tsx"),
    route("/www/admin/edit_course/:courseId", "routes/admin/edit_course.tsx"),
    route("/www/admin/course_detail/:courseId", "routes/admin/course_detail.tsx"),  

] satisfies RouteConfig;
