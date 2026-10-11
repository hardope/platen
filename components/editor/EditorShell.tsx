"use client";

import React, { useEffect, useRef } from "react";
import DocumentRuler from "./DocumentRuler";
import {
  MARGIN_SPECS,
  PAGE_GAP,
  PAGE_SIZE_SPECS,
  useDocumentLayout,
} from "@/context/DocumentLayoutContext";
import { cn } from "@/lib/utils";

interface EditorShellProps {
  children: React.ReactNode;
  // Rendered below the pages, outside the paper (e.g. the comments column)
  aside?: React.ReactNode;
  showRuler?: boolean;
}

/**
 * EditorShell provides the "paper on a desk" layout:
 * - Gray desktop viewport with vertical scroll (fluid white canvas in Pageless mode)
 * - Synchronized horizontal ruler sitting above the canvas with lockstep zoom scaling
 * - Discrete page sheets drawn behind a single editor; PaginationPlugin decides where
 *   each page's content starts and reports the page count
 */
export const EditorShell: React.FC<EditorShellProps> = ({ children, aside, showRuler = true }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const { layout, pageCount } = useDocumentLayout();
  const { width, pageHeight, paddingX, paddingY, isPageless, zoomFactor } = layout;

  // Synchronize horizontal scrolling between ruler and viewport at higher zoom levels
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onScroll = () => {
      if (rulerScrollRef.current) {
        rulerScrollRef.current.scrollLeft = viewport.scrollLeft;
      }
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  const scaledWidth = width * zoomFactor;
  const pageStride = pageHeight + PAGE_GAP;
  // Pageless documents print on Letter paper with normal margins
  const printPage = isPageless
    ? { ...PAGE_SIZE_SPECS.letter, padX: MARGIN_SPECS.normal.padX, padY: MARGIN_SPECS.normal.padY }
    : { width, height: pageHeight, padX: paddingX, padY: paddingY };

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden transition-colors duration-200 print:block print:overflow-visible",
        isPageless ? "bg-surface" : "bg-surface-canvas",
      )}
    >
      <style>{`@page { size: ${printPage.width}px ${printPage.height}px; margin: ${printPage.padY}px ${printPage.padX}px; }`}</style>

      {/* Sticky Ruler Bar (hidden in Pageless mode) */}
      {showRuler && !isPageless && (
        <div className="bg-surface-canvas/90 border-border z-10 w-full shrink-0 border-b backdrop-blur-xs print:hidden">
          <div ref={rulerScrollRef} className="scrollbar-none overflow-x-hidden px-4">
            <div
              className="mx-auto flex justify-center transition-all duration-200"
              style={{
                width: `${scaledWidth}px`,
              }}
            >
              <DocumentRuler
                pageWidth={width}
                marginLeft={paddingX}
                marginRight={paddingX}
                zoomFactor={zoomFactor}
              />
            </div>
          </div>
        </div>
      )}

      {/* Viewport Scroll Area */}
      <div
        ref={viewportRef}
        className={cn(
          "editor-viewport relative flex flex-1 flex-col items-center justify-start overflow-auto transition-colors duration-200 print:block print:overflow-visible",
          isPageless && "pageless",
        )}
      >
        {isPageless ? (
          /* Pageless Mode: Fluid continuous canvas that auto-expands with content */
          <div
            className="page-canvas-pageless bg-surface relative mx-auto h-auto min-h-[calc(100vh-140px)] w-full rounded-none border-none shadow-none transition-all duration-200"
            style={{
              paddingTop: `${paddingY}px`,
              paddingBottom: `${paddingY}px`,
            }}
          >
            {children}
            {aside && <div className="print:hidden">{aside}</div>}
          </div>
        ) : (
          /* Pages Mode: page sheets on the desk, with the document flowing across them */
          <>
            <div
              className="page-stack relative shrink-0"
              style={{
                width: `${width}px`,
                height: `${pageCount * pageStride - PAGE_GAP}px`,
                zoom: zoomFactor !== 1 ? `${zoomFactor}` : undefined,
              }}
            >
              {Array.from({ length: pageCount }, (_, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="page-sheet absolute inset-x-0"
                  style={{ top: `${index * pageStride}px`, height: `${pageHeight}px` }}
                >
                  <span className="page-number" style={{ bottom: `${paddingY / 2}px` }}>
                    {index + 1}
                  </span>
                </div>
              ))}

              <div
                className="page-canvas relative"
                style={{
                  paddingTop: `${paddingY}px`,
                  paddingLeft: `${paddingX}px`,
                  paddingRight: `${paddingX}px`,
                }}
              >
                {children}
              </div>
            </div>

            {aside && <div className="mt-10 flex w-full justify-center print:hidden">{aside}</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default EditorShell;
