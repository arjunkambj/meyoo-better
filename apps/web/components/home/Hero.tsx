"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import React from "react";

import { Button, Card, CardBody, Chip } from "@heroui/react";

const Hero = () => {
  return (
    <section className="relative w-full min-h-[calc(90vh)] flex items-center justify-center bg-background overflow-hidden pt-[calc(env(safe-area-inset-top)+56px)] sm:pt-[calc(env(safe-area-inset-top)+72px)] md:pt-10">
      <div className="container py-20 md:py-28 lg:py-36 mx-auto">
        <div className="text-center flex flex-col items-center">
          {/* Chip Badge */}
          <div className="inline-flex items-center gap-2.5 bg-default-200/50 border border-default-100  rounded-full px-5 py-2 mb-3">
            <Icon
              icon="solar:code-scan-bold-duotone"
              width={16}
              className="text-primary"
            />
            <span className="text-sm font-semibold text-primary">
              One Dashboard For Every Metric
            </span>
          </div>

          {/* Header  */}
          <h1 className="text-5xl leading-tight tracking-tighter md:text-6xl lg:text-7xl">
            <span className="font-semibold">Track, Manage, and Optimize</span>
            <br />
            <span className="font-playfair italic">Built for D2C Brands.</span>
          </h1>

          {/* Professional info */}
          <p className="mt-4 md:mt-6 text-lg md:text-xl lg:text-2xl text-default-600 max-w-3xl mx-auto">
            Forget about outdated spreadsheets, From orders to expenses with 10+
            Integrations. Everything your brand needs in one place
          </p>
          {/* CTA Buttons */}
          <div className="mt-8 md:mt-10 lg:mt-12 flex flex-col items-center gap-4 md:flex-row">
            <Button
              className="font-semibold px-8"
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={20} />}
              size="lg"
              variant="shadow"
            >
              Start Tracking
            </Button>
            <Button className="font-medium px-8" size="lg" variant="bordered">
              Watch Demo
            </Button>
          </div>

          {/* Money Back Guarantee */}
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 text-sm text-default-600">
              <Icon icon="solar:shield-check-bold" width={16} />
              <span>30-Day Money Back Guarantee</span>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 200 }}
          animate={{ opacity: 100, y: 0 }}
          transition={{ ease: [0, 0.71, 0.2, 1.01], duration: 0.8 }}
        >
          <Card className="group mx-auto mt-16  h-100 w-full rounded-4xl border border-default-200 bg-content2/30 p-2 shadow-none md:h-190 md:p-3">
            <CardBody className="size-full rounded-3xl border-2 border-background bg-content2">
              <img
                src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
                className="size-full"
                alt=""
              />
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export { Hero };

const Flash = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    width="13"
    height="15"
    viewBox="0 0 13 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.55191 6.02443L11.7837 7.65512C12.3525 7.87431 12.4411 8.64213 11.9371 8.98504L4.63357 13.9543C3.81688 14.51 2.7714 13.6807 3.12658 12.759L4.73014 8.59757L0.498337 6.96688C-0.0704765 6.74769 -0.159028 5.97986 0.34496 5.63695L7.64848 0.667678C8.46517 0.112006 9.51065 0.941277 9.15547 1.86301L7.55191 6.02443Z"
      fill="white"
    />
  </svg>
);

const Line = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    width="83"
    height="36"
    viewBox="0 0 83 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M40.54 19.8917L41.3058 20.5348L40.54 19.8917ZM1.63581 24.9844C1.0855 25.0311 0.677219 25.515 0.723883 26.0653L1.48433 35.0331C1.53099 35.5834 2.01493 35.9917 2.56524 35.9451C3.11555 35.8984 3.52384 35.4144 3.47717 34.8641L2.80123 26.8927L10.7726 26.2168C11.3229 26.1701 11.7312 25.6862 11.6845 25.1359C11.6379 24.5856 11.1539 24.1773 10.6036 24.2239L1.63581 24.9844ZM82.2736 5.64287C76.5724 3.44962 72.1116 1.90993 68.3792 1.17068C64.6243 0.426972 61.5404 0.479043 58.619 1.52454C55.7174 2.56298 53.0827 4.54437 50.1573 7.45564C47.236 10.3628 43.9495 14.2763 39.7742 19.2487L41.3058 20.5348C45.5032 15.5361 48.7246 11.703 51.5681 8.87328C54.4074 6.04765 56.7943 4.30177 59.2929 3.40759C61.7717 2.52047 64.4665 2.43457 67.9906 3.13257C71.5372 3.83502 75.8555 5.3167 81.5555 7.50951L82.2736 5.64287ZM39.7742 19.2487C31.6752 28.8938 24.4557 32.0798 18.3123 32.0962C12.1277 32.1127 6.75778 28.9224 2.36514 25.2165L1.07548 26.7451C5.60504 30.5666 11.4303 34.1146 18.3177 34.0962C25.2462 34.0777 32.9755 30.4554 41.3058 20.5348L39.7742 19.2487Z"
      fill="black"
    />
  </svg>
);
