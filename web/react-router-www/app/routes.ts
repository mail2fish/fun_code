import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/login.tsx"),
    route("/react/dashboard", "routes/dashboard.tsx"),
    route("/react/scratch/projects", "routes/scratch_projects.tsx"),
] satisfies RouteConfig;
