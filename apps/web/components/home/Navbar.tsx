"use client";

import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";
import { Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/navbar";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/shared/Logo";

const navItems = [
  { name: "Integrations", href: "#integrations" },
  { name: "Testimonials", href: "#testimonials" },
  { name: "Pricing", href: "/pricing" },
  { name: "FAQ", href: "#faq" },
  { name: "Contact", href: "/contact" },
];

export default function CenteredNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [hasScrolled, setHasScrolled] = useState(false);
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

          const sections = navItems.map((item) => item.href.substring(1));
          const currentSection = sections.find((section) => {
            const element = document.getElementById(section);
            if (element) {
              const rect = element.getBoundingClientRect();
              return rect.top <= 100 && rect.bottom >= 100;
            }
            return false;
          });

          setActiveSection(currentSection || "");
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

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="fixed w-full top-1 z-50 px-4 md:px-6 py-2 md:py-3">
      <div className="max-w-[80vw] mx-auto">
        <Navbar
          className={`
            ${hasScrolled ? "bg-transparent border-1 border-default-300" : "bg-transparent border-1 border-default-300/60"}
            rounded-xl transition-all duration-300
          `}
          classNames={{
            base: "px-3 md:px-5 py-2.5 md:py-3 rounded-lg",
            wrapper: "px-0 max-w-none",
          }}
          height="auto"
        >
          {/* Left side - Logo */}
          <NavbarContent className="shrink-0" justify="start">
            <NavbarBrand>
              <Link
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                href="/"
              >
                <Logo />
              </Link>
            </NavbarBrand>
          </NavbarContent>

          {/* Center - Navigation Items */}
          <NavbarContent className="hidden md:flex flex-1" justify="center">
            <div className="flex items-center gap-4">
              {navItems.map((item) => (
                <NavbarItem key={item.name}>
                  <Button
                    className={`relative px-2 py-2 transition-all bg-transparent hover:bg-transparent duration-200 font-medium text-sm  group h-auto min-w-0 ${
                      activeSection === item.href.substring(1) ||
                      (item.href === "/contact" && currentPath === "/contact")
                        ? "text-primary"
                        : "text-default-700 hover:text-primary"
                    }`}
                    onPress={() => {
                      if (item.href.startsWith("/")) {
                        router.push(item.href);
                      } else {
                        scrollToSection(item.href);
                      }
                    }}
                  >
                    {item.name}
                    <span
                      className={`absolute bottom-0 left-0 w-full h-0.5 bg-primary transition-transform duration-200 origin-left ${
                        activeSection === item.href.substring(1) ||
                        (item.href === "/contact" && currentPath === "/contact")
                          ? "scale-x-100"
                          : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Button>
                </NavbarItem>
              ))}
            </div>
          </NavbarContent>

          {/* Right side - CTA */}
          <NavbarContent className="hidden md:flex  shrink-0" justify="end">
            <NavbarItem>
              <Button
                as={Link}
                className="font-semibold"
                color="primary"
                endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
                href="/signin"
                radius="lg"
                size="md"
              >
                Get started
              </Button>
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Menu Toggle */}
          <NavbarContent className="md:hidden shrink-0" justify="end">
            <NavbarItem>
              <Button
                isIconOnly
                className="text-default-700 hover:bg-content1/50 dark:hover:bg-default-100/50 backdrop-blur-sm"
                radius="lg"
                variant="light"
                onPress={() => setIsMenuOpen(true)}
              >
                <Icon className="text-xl" icon="mdi:menu" />
              </Button>
            </NavbarItem>
          </NavbarContent>

          {/* Mobile Modal */}
          <Modal
            classNames={{
              base: "bg-content1/95 dark:bg-content1/95 backdrop-blur-sm",
              body: "py-6",
            }}
            isOpen={isMenuOpen}
            placement="top"
            size="full"
            onClose={() => setIsMenuOpen(false)}
          >
            <ModalContent className="p-6">
              <ModalBody>
                <div className="flex flex-col h-full">
                  {/* Mobile Header */}
                  <div className="flex items-center justify-between pb-6 border-b border-divider">
                    <Logo />
                    <Button
                      isIconOnly
                      className="text-default-700 hover:bg-default-100"
                      variant="light"
                      onPress={() => setIsMenuOpen(false)}
                    >
                      <Icon className="text-xl" icon="mdi:close" />
                    </Button>
                  </div>

                  {/* Mobile Navigation */}
                  <div className="flex-1 flex flex-col justify-center space-y-8">
                    {navItems.map((item) => (
                      <Button
                        key={item.name}
                        variant="light"
                        className="text-xl font-semibold text-foreground hover:text-primary transition-colors duration-200 text-left justify-start p-0 h-auto min-w-0"
                        onClick={() => {
                          if (item.href.startsWith("/")) {
                            router.push(item.href);
                          } else {
                            scrollToSection(item.href);
                          }
                          setIsMenuOpen(false);
                        }}
                      >
                        {item.name}
                      </Button>
                    ))}

                    {/* CTA buttons */}
                    <div className="pt-8 space-y-4">
                      <Button
                        as={Link}
                        className="w-full font-semibold"
                        color="primary"
                        href="/signin"
                        radius="full"
                        size="lg"
                      >
                        Get Started Now
                        <Icon className="ml-2" icon="mdi:arrow-right" />
                      </Button>
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
