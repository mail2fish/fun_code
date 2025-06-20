import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),

    // user
    route("/www/dashboard", "routes/user/dashboard.tsx"),
    route("/www/scratch/projects", "routes/scratch_projects.tsx"),
    route("/www/scratch/project/:projectId/histories", "routes/scratch_project_histories.tsx"),
    route("/www/files/list", "routes/list_files.tsx"),
    route("/www/shares/user", "routes/user_share.tsx"),
    route("/www/shares/all", "routes/all_share.tsx"),

    // admin
    route("/www/admin/dashboard", "routes/admin/dashboard.tsx"),
    route("/www/admin/users/list", "routes/admin/list_users.tsx"),
    route("/www/admin/users/:userId/edit", "routes/admin/edit_user.tsx"),
    route("/www/admin/users/create", "routes/admin/create_user.tsx"),
    route("/www/admin/files/upload", "routes/admin/upload_files.tsx"),
    route("/www/admin/classes/create", "routes/admin/create_class.tsx"),
    route("/www/admin/classes/list", "routes/admin/list_classes.tsx"),
    route("/www/admin/classes/:classId/edit", "routes/admin/edit_class.tsx"),  

] satisfies RouteConfig;
