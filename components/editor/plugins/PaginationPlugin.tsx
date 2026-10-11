"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { PAGE_GAP, useDocumentLayout } from "@/context/DocumentLayoutContext";

// Sub-pixel slack so rounding never pushes a block that fits exactly
const FIT_TOLERANCE = 1;

const isPageBreak = (block: Element) => block.classList.contains("page-break-wrapper");
const isHeading = (block: Element) => /^H[1-6]$/.test(block.tagName);

/**
 * Lays the document out on discrete pages without changing the document itself.
 *
 * After every content change it measures the top-level blocks in their natural flow and,
 * whenever a block would cross the bottom margin of its page (or follows a manual page
 * break), gives it a top margin that moves it to the start of the next page. The margins
 * live in a generated stylesheet rather than on the elements, because Lexical owns those
 * elements and pagination must stay local: each collaborator lays out their own view.
 *
 * Blocks taller than a whole page (a long table, a very long paragraph) still flow across
 * the page gap; splitting inside a block is not handled yet.
 */
export default function PaginationPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { layout, setPageCount } = useDocumentLayout();
  const { pageHeight, paddingY, isPageless } = layout;

  useEffect(() => {
    if (isPageless) {
      setPageCount(1);
      return;
    }

    const stride = pageHeight + PAGE_GAP;
    const usableHeight = pageHeight - paddingY * 2;
    const spacerSheet = document.createElement("style");
    spacerSheet.dataset.pagination = "";
    document.head.appendChild(spacerSheet);

    let frame = 0;
    let appliedCss = "";

    const paginate = () => {
      const root = editor.getRootElement();
      if (!root) return;

      // Measure the natural flow with every page-break margin removed
      spacerSheet.disabled = true;
      const blocks = Array.from(root.children);
      const tops = blocks.map((block) => (block as HTMLElement).offsetTop);
      const heights = blocks.map((block) => (block as HTMLElement).offsetHeight);
      spacerSheet.disabled = false;

      const rules: string[] = [];
      let page = 0;
      let shift = 0; // how far the blocks pushed so far have moved everything below them
      let blocksOnPage = 0;
      let startNewPage = false;

      // Moves a block (and with it everything after it) to the top of the current page
      const moveToPageTop = (index: number) => {
        const pageTop = page * stride;
        const top = tops[index] + shift;
        const previousBottom = index > 0 ? tops[index - 1] + heights[index - 1] : 0;
        const naturalGap = tops[index] - previousBottom;

        // Replaces the block's own top margin, which collapses with the one above it
        rules.push(
          `.editor-input > :nth-child(${index + 1}) { margin-top: ${naturalGap + pageTop - top}px !important; }`,
        );
        shift += pageTop - top;
        blocksOnPage = 0;
      };

      blocks.forEach((block, index) => {
        const pageBreak = isPageBreak(block);
        const overflows =
          tops[index] + shift + heights[index] > page * stride + usableHeight + FIT_TOLERANCE;

        if (!startNewPage && blocksOnPage > 0 && !pageBreak && overflows) {
          page += 1;

          // Keep a heading on the same page as the block it introduces
          if (blocksOnPage > 1 && isHeading(blocks[index - 1])) {
            moveToPageTop(index - 1);
            blocksOnPage = 1;
          } else {
            startNewPage = true;
          }
        }

        if (startNewPage) {
          moveToPageTop(index);
          startNewPage = false;
        }

        blocksOnPage += 1;
        const bottom = tops[index] + shift + heights[index];

        if (pageBreak) {
          page += 1;
          startNewPage = true;
        } else if (bottom > page * stride + usableHeight + FIT_TOLERANCE) {
          // A block taller than the space left on a fresh page flows on to the page it ends on
          page = Math.floor(bottom / stride);
          blocksOnPage = 1;
          if (bottom - page * stride > usableHeight) {
            page += 1;
            startNewPage = true;
          }
        }
      });

      // Screen only: printing lets the browser paginate with the @page setup instead
      const css = rules.length ? `@media screen {\n${rules.join("\n")}\n}` : "";
      if (css !== appliedCss) {
        spacerSheet.textContent = css;
        appliedCss = css;
      }
      // A trailing manual break opens an empty page, as in other word processors
      setPageCount(page + 1);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paginate);
    };

    // Catches images, embeds and fonts finishing loading after the text has rendered
    const resizeObserver = new ResizeObserver(schedule);

    const removeRootListener = editor.registerRootListener((root) => {
      resizeObserver.disconnect();
      if (root) {
        resizeObserver.observe(root);
        schedule();
      }
    });

    const removeUpdateListener = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      // Selection-only updates cannot move anything
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) schedule();
    });

    document.fonts?.ready.then(schedule);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      removeRootListener();
      removeUpdateListener();
      spacerSheet.remove();
    };
  }, [editor, isPageless, pageHeight, paddingY, setPageCount]);

  return null;
}
