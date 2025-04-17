import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("/www/dashboard", "routes/dashboard.tsx"),
    route("/www/scratch/projects", "routes/scratch_projects.tsx"),
    route("/www/class/create", "routes/create_class.tsx"),
    route("/www/class/list", "routes/list_class.tsx"),
    route("/www/class/:classId/edit", "routes/edit_class.tsx"),  

] satisfies RouteConfig;
