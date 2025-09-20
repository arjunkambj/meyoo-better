"use client";

import { Accordion, AccordionItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "How do you calculate real profit?",
    answer:
      "Meyoo pulls orders from Shopify and spend from ad platforms, then subtracts COGS, shipping, fees, returns, and taxes to show true profit.",
  },
  {
    question: "How fast does data update?",
    answer:
      "Orders sync instantly. Ad spend updates about every 15 minutes. Changes to costs update your profit view immediately.",
  },
  {
    question: "Can I slice by product or channel?",
    answer:
      "Yes. Segment by product, campaign, traffic source, region, and more so you can see exactly what drives margins.",
  },
  {
    question: "What integrations are supported?",
    answer:
      "Shopify, Meta Ads, and Google Ads today. Coming soon: TikTok Ads, Amazon FBA, and popular email platforms.",
  },
  {
    question: "Will this scale with my store?",
    answer:
      "Yes. Meyoo handles high volume and sales events, keeping hourly profit and campaign performance responsive.",
  },
  {
    question: "How is my data secured?",
    answer:
      "Encryption in transit and at rest, role-based access, and GDPR-friendly data handling. Your data is isolated per organization.",
  },
];

export default function FAQ({ className }: { className?: string }) {
  return (
    <section
      className={`relative w-full py-24 bg-background overflow-hidden ${className}`}
    >
      {/* Section background unify */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Thin 1px gradient line at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-primary/25" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-5 py-2 mb-10">
            <Icon
              className="text-primary"
              icon="solar:question-circle-bold"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Frequently Asked Questions
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Got Questions?
            <span className="block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              We&apos;ve Got Answers
            </span>
          </h2>
          <p className="text-lg text-default-600 max-w-2xl mx-auto">
            Short answers on how Meyoo computes and displays true profit for
            Shopify brands.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          className="w-full max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Accordion
            className="w-full lg:min-w-2xl"
            fullWidth={true}
            itemClasses={{
              base: "w-full min-w-full max-w-full block transition-none data-[open=true]:w-full data-[open=false]:w-full",
              title: "font-medium text-foreground w-full min-w-full",
              trigger:
                "px-6 py-6 w-full min-w-full flex items-center justify-between transition-colors",
              indicator: "text-primary shrink-0",
              content: "text-default-600 px-6 pb-6 pt-2 w-full",
            }}
            variant="light"
          >
            {faqs.map((faq, _index) => (
              <AccordionItem
                key={faq.question}
                aria-label={faq.question}
                className="border-b border-default-200/50 dark:border-default-100/40 last:border-0 mb-0"
                indicator={({ isOpen }) => (
                  <Icon
                    className={`text-primary transition-transform duration-200 ${
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
                <p className="leading-relaxed break-words">{faq.answer}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-12 sm:mt-16 text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-10 border border-divider relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 dark:ring-white/5" />
            <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 sm:mb-3">
              Still have questions?
            </h3>
            <p className="text-sm sm:text-base text-default-600 mb-4 sm:mb-6 px-4 sm:px-0">
              Contact our team for help.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                color="primary"
                radius="lg"
                startContent={<Icon icon="solar:letter-bold" width={20} />}
                onPress={() => {
                  window.location.href = "mailto:support@meyoo.com";
                }}
              >
                Email support
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
