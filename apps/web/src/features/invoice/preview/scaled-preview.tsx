import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const PAGE_WIDTH = 816; // US Letter at 96 dpi (8.5in)

/**
 * Renders its child at true Letter size and scales it down to fit the available width,
 * so the preview is a faithful miniature of the printed page. Scaling is removed in print.
 */
export function ScaledPreview({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(1056);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1, container.clientWidth / PAGE_WIDTH));
      setPageHeight(page.offsetHeight);
    });
    observer.observe(container);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full print:!h-auto" style={{ height: pageHeight * scale }}>
      <div
        ref={pageRef}
        className="origin-top-left overflow-hidden rounded-[3px] shadow-paper print:!transform-none print:rounded-none print:shadow-none"
        style={{ width: PAGE_WIDTH, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
