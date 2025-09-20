"use client";

import { Drawer, DrawerBody, DrawerContent } from "@heroui/drawer";
import { useAtom } from "jotai";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks";
import { sidebarOpenAtom } from "@/store/atoms";
import { LAYOUT_STYLES } from "@/constants/styles";
import SidebarContent from "./SidebarContent";

const DashboardSidebar = React.memo(({ className }: { className?: string }) => {
  const [isOpen, setIsOpen] = useAtom(sidebarOpenAtom);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(prev => !prev);
  }, [setIsOpen]);

  const handleResizeLogic = useCallback(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    setIsOpen(!mobile);
  }, [setIsOpen]);

  const handleResize = useDebounce(handleResizeLogic, 150);

  const handleDrawerOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
    },
    [setIsOpen]
  );

  useEffect(() => {
    setIsClient(true);
    handleResizeLogic();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize, handleResizeLogic]);

  const sidebarContent = useMemo(
    () => <SidebarContent onClose={handleClose} isOpen={isOpen} />,
    [handleClose, isOpen]
  );

  const drawerClasses = useMemo(
    () => LAYOUT_STYLES.sidebar.drawer,
    []
  );

  const sectionClasses = useMemo(
    () => `h-full ${className || ""}`,
    [className]
  );

  const drawerContent = useMemo(
    () => (
      <Drawer
        hideCloseButton
        backdrop="transparent"
        className={drawerClasses}
        isOpen={isOpen}
        placement="left"
        radius="none"
        shadow="none"
        onOpenChange={handleDrawerOpenChange}
      >
        <DrawerContent className="p-0">
          {(onClose) => (
            <DrawerBody className="p-0 rounded-none">
              <SidebarContent onClose={onClose} isOpen={isOpen} />
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
    ),
    [drawerClasses, isOpen, handleDrawerOpenChange]
  );

  if (!isClient) {
    return <section className={sectionClasses}>{sidebarContent}</section>;
  }

  return (
    <section className={sectionClasses}>
      {!isMobile && sidebarContent}
      {isMobile && drawerContent}
    </section>
  );
});

DashboardSidebar.displayName = "DashboardSidebar";

export default DashboardSidebar;
