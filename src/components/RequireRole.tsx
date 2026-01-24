import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.tsx";
import type { UserRole } from "../models/types.ts";

interface RequireRoleProps {
  children: JSX.Element;
  role?: UserRole;
  roles?: UserRole[];
}

export function RequireRole({ children, role, roles }: RequireRoleProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-500">
        Laddar...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = roles || (role ? [role] : []);

  // Implicit hierarchy: Developer > Admin
  // If we require 'admin', 'developer' is also allowed.
  // If we require 'developer', only 'developer' is allowed.

  let hasPermission = false;

  if (allowedRoles.length === 0) {
    // No specific role required, just auth
    hasPermission = true;
  } else {
    if (allowedRoles.includes("admin")) {
      if (user.role === "admin" || user.role === "developer") {
        hasPermission = true;
      }
    }

    if (allowedRoles.includes("developer")) {
      if (user.role === "developer") hasPermission = true;
    }

    // Fallback for exact matches of other roles if we ever use them
    if (!hasPermission && allowedRoles.includes(user.role)) {
      hasPermission = true;
    }
  }

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return children;
}
