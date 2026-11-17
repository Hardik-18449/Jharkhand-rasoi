import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { isModuleAuthenticated } from "../auth/session";

/** Port of web ProtectedRoute(requiredRole="user"): redirects to login with `from`. */
export default function RequireAuth({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const ok = isModuleAuthenticated();
  useEffect(() => {
    if (!ok) router.replace({ pathname: "/login", params: { from: pathname } });
  }, [ok, pathname, router]);
  if (!ok) return null;
  return children;
}
