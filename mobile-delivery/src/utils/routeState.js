/** Tracks the current route path (web code read window.location.pathname in non-component code). */
let currentPath = "/";
export const setCurrentRoutePath = (p) => {
  currentPath = p || "/";
};
export const getCurrentRoutePath = () => currentPath;
