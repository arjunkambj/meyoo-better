"use client";

import { useEffect } from "react";

const AUTO_HIDE_DELAY_MS = 1500;
const ACTIVATION_ZONE_PX = 16;

export function ScrollbarController() {
  useEffect(() => {
    const root = document.documentElement;
    let hideTimer: number | null = null;

    const scheduleHide = () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        root.classList.remove("scrollbar-visible");
      }, AUTO_HIDE_DELAY_MS);
    };

    const revealScrollbar = () => {
      root.classList.add("scrollbar-visible");
      scheduleHide();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      const nearVerticalScrollbar = window.innerWidth - event.clientX <= ACTIVATION_ZONE_PX;
      const nearHorizontalScrollbar = window.innerHeight - event.clientY <= ACTIVATION_ZONE_PX;

      if (nearVerticalScrollbar || nearHorizontalScrollbar) {
        revealScrollbar();
      }
    };

    const handleScroll = (event: Event) => {
      const target = event.target;

      if (
        target === document ||
        target === document.documentElement ||
        target === document.body ||
        target === window
      ) {
        revealScrollbar();
        return;
      }

      if (target instanceof Element) {
        revealScrollbar();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });

    revealScrollbar();

    return () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll, true);
      root.classList.remove("scrollbar-visible");
    };
  }, []);

  return null;
}
