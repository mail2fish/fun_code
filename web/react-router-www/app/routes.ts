import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("/dashboard", "routes/dashboard.tsx"),
    route("/scratch/projects", "routes/scratch_projects.tsx"),
] satisfies RouteConfig;
