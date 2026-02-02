import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    
    // Set initial value
    checkMobile();
    
    // Listen for changes
    const onChange = () => checkMobile();
    mql.addEventListener("change", onChange);
    
    // Also listen to resize events for better responsiveness
    window.addEventListener("resize", checkMobile);
    
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}
