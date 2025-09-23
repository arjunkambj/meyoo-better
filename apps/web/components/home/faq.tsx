"use client";

import { Accordion, AccordionItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

const faqs = [
  {
    question: "How does Meyoo figure out my profit?",
    answer:
      "We sync Shopify orders and ad spend, then subtract the costs you track—COGS, shipping, payment fees, returns, and taxes—so you see a true profit line.",
  },
  {
    question: "How fresh is the data?",
    answer:
      "Orders show up instantly. Ad channels refresh about every 15 minutes, and any cost changes you make update your numbers right away.",
  },
  {
    question: "Can I break results down by product or channel?",
    answer:
      "Yes. Filter by product, campaign, traffic source, region, day, and more to see what is helping or hurting margin.",
  },
  {
    question: "Which integrations are live today?",
    answer:
      "Shopify, Meta Ads, and Google Ads are available now. TikTok Ads, Amazon, and leading email platforms are on the roadmap.",
  },
  {
    question: "Will Meyoo keep up as we scale?",
    answer:
      "Yes. We handle high order volume and sales spikes while keeping profit and campaign performance responsive.",
  },
  {
    question: "How is our data protected?",
    answer:
      "Your data stays encrypted in transit and at rest. Each organization gets isolated access with roles so only the right people can view sensitive numbers.",
  },
];

const Faq = () => {
  return (
    <section
      id="faq"
      className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 scroll-mt-24"
    >
      <div className="container mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
              Need a hand?
              <br />
              <span className="text-muted-foreground/70">
                Our team replies within a business day.
              </span>
            </h2>
            <p className="text-base text-muted-foreground sm:text-lg md:text-xl">
              Still stuck? Drop a note to our
              <a href="mailto:support@meyoo.app" className="mx-1 whitespace-nowrap underline">
                support team
              </a>
              and we&apos;ll point you in the right direction.
            </p>
            <Button size="lg" variant="bordered" className="w-full sm:w-fit">
              View all FAQs
            </Button>
          </div>
          <Accordion
            className="w-full"
            fullWidth={true}
            itemClasses={{
              base: "w-full min-w-full max-w-full block transition-none data-[open=true]:w-full data-[open=false]:w-full",
              title: "font-medium text-foreground w-full min-w-full",
              trigger:
                "px-4 sm:px-6 py-5 sm:py-6 w-full min-w-full flex items-center justify-between transition-colors",
              indicator: "text-primary shrink-0",
              content: "text-default-600 px-4 sm:px-6 pb-5 sm:pb-6 pt-2 w-full",
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
        </div>
      </div>
    </section>
  );
};

export { Faq };
