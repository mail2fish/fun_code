import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("/www/dashboard", "routes/dashboard.tsx"),
    route("/www/scratch/projects", "routes/scratch_projects.tsx"),
    route("/www/scratch/project/:projectId/histories", "routes/scratch_project_histories.tsx"),
    route("/www/classes/create", "routes/create_class.tsx"),
    route("/www/classes/list", "routes/list_classes.tsx"),
    route("/www/classes/:classId/edit", "routes/edit_class.tsx"),  
    route("/www/admin/users/list", "routes/list_users.tsx"),
    route("/www/admin/users/:userId/edit", "routes/edit_user.tsx"),
    route("/www/admin/users/create", "routes/create_user.tsx"),
    route("/www/admin/scratch/projects", "routes/admin_scratch_projects.tsx"),
] satisfies RouteConfig;
