// Fallback static home routes (teams directory) used when no contextual team is known
// Mobile breakpoint: screens below 768px are considered mobile
const MOBILE_BREAKPOINT = 768;

// Function to check if current screen width is mobile
export const isMobileWidth = (): boolean => {
  return window.innerWidth < MOBILE_BREAKPOINT;
};
