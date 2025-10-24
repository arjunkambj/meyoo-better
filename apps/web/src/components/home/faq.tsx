"use client";

import { Accordion, AccordionItem } from "@heroui/accordion";
import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import { designSystem } from "@/libs/design-system";

const faqs = [
  {
    question: "How does Meyoo calculate profit?",
    answer:
      "We combine revenue with product cost (COGS), shipping, discounts, transaction fees, refunds, and ad spend to show true profit by order, SKU, and campaign.",
  },
  {
    question: "What do I need to get started?",
    answer:
      "Connect Shopify and your ad channels. Add product costs (upload or edit inline). You’ll see profit start to populate right away.",
  },
  {
    question: "Which integrations are available?",
    answer:
      "Shopify, Meta Ads, Google Ads, TikTok Ads, Snapchat, and Google Analytics—with more coming soon.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Yes. Export CSVs or copy to clipboard for quick shares. (API and scheduled exports on Growth+ plans.)",
  },
  {
    question: "Is my data secure?",
    answer:
      "We use modern encryption and strict access controls. Your data is yours—we never sell it. (Add your formal security/legal language here.)",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. Manage your plan from your account settings with one click.",
  },
];

const Faq = () => {
  return (
    <section
      id="faq"
      className={`relative pt-12 sm:pt-16 lg:pt-20 2xl:pt-24 pb-12 sm:pb-16 lg:pb-20 2xl:pb-24 ${designSystem.background.gradient} w-full scroll-mt-24`}
    >
      <div className={`${designSystem.spacing.container} max-w-7xl`}>
        <div className="text-center mb-12">
          <div className={designSystem.typography.sectionChip}>
            <span className="text-sm uppercase tracking-[0.15em] font-medium text-primary/70">
              FAQ
            </span>
          </div>
          <h2 className={designSystem.typography.sectionTitle}>Common Questions</h2>
          <p className={designSystem.typography.sectionSubtitle}>
            We&apos;re here to help you get the most out of Meyoo.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h3 className="text-2xl font-semibold tracking-tight">
              Need personalized help?
            </h3>
            <p className="text-base text-muted-foreground">
              Drop a note to our
              <a
                href="mailto:support@meyoo.app"
                className="mx-1 whitespace-nowrap underline text-primary hover:text-primary/80 transition-colors"
              >
                support team
              </a>
              and we&apos;ll point you in the right direction.
            </p>
            <Button size="lg" color="primary" className="w-full sm:w-fit ">
              Contact Support
            </Button>
          </div>
          <Accordion
            className="w-full"
            fullWidth={true}
            itemClasses={{
              base: "w-full min-w-full max-w-full block bg-transparent backdrop-blur-sm rounded-xl mb-2 transition-all duration-300",
              title: "font-medium text-foreground w-full min-w-full",
              trigger:
                "px-4 sm:px-6 py-5 sm:py-6 w-full min-w-full flex items-center justify-between",
              indicator: "text-primary shrink-0",
              content: "text-default-600 px-4 sm:px-6 pb-5 sm:pb-6 pt-2 w-full",
            }}
            variant="light"
          >
            {faqs.map((faq, _index) => (
              <AccordionItem
                key={faq.question}
                aria-label={faq.question}
                className="mb-0"
                indicator={({ isOpen }) => (
                  <Icon
                    className={`text-primary/60 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    icon="solar:alt-arrow-down-outline"
                    width={20}
                  />
                )}
                title={
                  <span className="block w-full pr-8">{faq.question}</span>
                }
              >
                <p className="leading-relaxed break-words text-muted-foreground">
                  {faq.answer}
                </p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export { Faq };
