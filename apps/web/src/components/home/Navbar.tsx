"use client";

import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Icon } from "@iconify/react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

import { Logo } from "@/components/shared/Logo";
import { designSystem } from "@/libs/design-system";

const navItems: { name: string; href: Route }[] = [
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
  { name: "Pricing", href: "/pricing" },
];

export default function CenteredNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, setHasScrolled] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    setCurrentPath(window.location.pathname);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    let ticking = false;

    const handleScroll = () => {
      if (isMenuOpen) return; // avoid work while modal is open

      if (!ticking) {
        window.requestAnimationFrame(() => {
          setHasScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };

    // Set initial scroll state
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () =>
      window.removeEventListener("scroll", handleScroll as EventListener);
  }, [isClient, isMenuOpen]);

  // Lock body scroll when mobile menu is open to reduce paint cost
  useEffect(() => {
    if (!isClient) return;
    const original = document.body.style.overflow;
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = original || "";
    }
    return () => {
      document.body.style.overflow = original || "";
    };
  }, [isClient, isMenuOpen]);

  return (
    <div className="sticky top-0 bg-background z-50 w-full py-1">
      <div className={`${designSystem.spacing.container} flex w-full`}>
        <Navbar
          isBlurred={false}
          maxWidth="full"
          className={`
                       w-full rounded-2xl bg-transparent transition-all duration-300
          `}
          classNames={{
            base: "px-2 sm:px-4 md:px-6 py-2.5 sm:py-2.5 md:py-4 rounded-2xl w-full",
            wrapper: "px-0 w-full gap-2 sm:gap-4",
          }}
          height="auto"
        >
          {/* Left side - Logo */}
          <NavbarContent className="shrink-0" justify="start">
            <NavbarBrand className="gap-0">
              <Link
                className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity"
                href="/"
              >
                <Logo />
              </Link>
            </NavbarBrand>
          </NavbarContent>

          {/* Center - Navigation Items */}
          <NavbarContent className="hidden md:flex flex-1" justify="center">
            <div className="flex items-center gap-10">
              {navItems.map((item) => (
                <NavbarItem key={item.name}>
                  <Button
                    className={`relative px-3 py-2 transition-all bg-transparent hover:bg-transparent duration-300 font-medium text-sm group h-auto min-w-0 ${
                      currentPath === item.href
                        ? "text-primary"
                        : "text-default-700 hover:text-primary"
                    }`}
                    onPress={() => router.push(item.href)}
                  >
                    {item.name}
                    <span
                      className={`absolute bottom-0 left-0 w-full h-0.5 bg-primary/60 rounded-full transition-transform duration-300 origin-left ${
                        currentPath === item.href
                          ? "scale-x-100"
                          : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Button>
                </NavbarItem>
              ))}
            </div>
          </NavbarContent>

          {/* Right side - CTA (Meyoo) */}
          <NavbarContent
            className="hidden md:flex shrink-0 flex-grow-0"
            justify="end"
          >
            <NavbarItem>
              <Unauthenticated>
                <Button
                  as={Link}
                  className="w-full font-semibold"
                  color="primary"
                  href="/signin"
                >
                  Try Meyoo free
                  <Icon className="ml-2" icon="mdi:arrow-right" />
                </Button>
              </Unauthenticated>
              <AuthLoading>
                <Button as={Link} href="/signin" color="primary">
                  Try Meyoo free
                </Button>
              </AuthLoading>
              <Authenticated>
                <Button
                  as={Link}
                  className="px-8"
                  href="/overview"
                  color="primary"
                >
                  Dashboard
                </Button>
              </Authenticated>
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Menu Toggle */}
          <NavbarContent
            className="md:hidden shrink-0 flex-grow-0"
            justify="end"
          >
            <NavbarItem>
              <Button
                isIconOnly
                className="text-muted-foreground hover:bg-muted/50 backdrop-blur-sm transition-all duration-300 w-9 h-9 min-w-9"
                radius="full"
                size="sm"
                variant="light"
                onPress={() => setIsMenuOpen(true)}
              >
                <Icon className="text-lg" icon="mdi:menu" />
              </Button>
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Modal */}
          <Modal
            classNames={{
              base: "bg-background/95 backdrop-blur-md rounded-2xl m-4",
              body: "py-4 sm:py-6",
            }}
            isOpen={isMenuOpen}
            placement="top"
            size="full"
            onClose={() => setIsMenuOpen(false)}
          >
            <ModalContent className="p-4 sm:p-6">
              <ModalBody>
                <div className="flex flex-col h-full min-h-[calc(100vh-2rem)]">
                  {/* Mobile Header */}
                  <div className="flex items-center justify-between pb-4 sm:pb-6">
                    <Logo />
                    <Button
                      isIconOnly
                      className="text-muted-foreground hover:bg-muted/50 transition-all duration-300 w-9 h-9 min-w-9"
                      size="sm"
                      variant="light"
                      onPress={() => setIsMenuOpen(false)}
                    >
                      <Icon className="text-lg" icon="mdi:close" />
                    </Button>
                  </div>

                  {/* Mobile Navigation */}
                  <div className="flex-1 flex flex-col justify-center space-y-6 sm:space-y-8 py-8">
                    {navItems.map((item) => (
                      <Button
                        key={item.name}
                        variant="light"
                        className="text-lg sm:text-xl font-medium text-muted-foreground hover:text-primary transition-colors duration-300 text-left justify-start p-0 h-auto min-w-0"
                        onPress={() => {
                          router.push(item.href);
                          setIsMenuOpen(false);
                        }}
                      >
                        {item.name}
                      </Button>
                    ))}

                    {/* CTA buttons */}
                    <div className="pt-6 sm:pt-8 space-y-3 sm:space-y-4">
                      <Unauthenticated>
                        <Button
                          as={Link}
                          className="w-full font-semibold text-sm sm:text-base"
                          color="primary"
                          href="/signin"
                          radius="full"
                          size="lg"
                        >
                          Try Meyoo free
                          <Icon className="ml-2" icon="mdi:arrow-right" />
                        </Button>
                      </Unauthenticated>
                      <AuthLoading>
                        <Button
                          className="w-full font-semibold text-sm sm:text-base"
                          color="primary"
                          radius="full"
                          size="lg"
                        >
                          Try Meyoo free
                        </Button>
                      </AuthLoading>
                      <Authenticated>
                        <Button
                          as={Link}
                          className="w-full font-semibold text-sm sm:text-base"
                          color="primary"
                          href="/overview"
                          radius="full"
                          size="lg"
                        >
                          Dashboard
                        </Button>
                      </Authenticated>
                    </div>
                  </div>
                </div>
              </ModalBody>
            </ModalContent>
          </Modal>
        </Navbar>
      </div>
    </div>
  );
}
