"use client";

import { Accordion, AccordionItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

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

const Faq = () => {
  return (
    <section
      id="faq"
      className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 scroll-mt-24"
    >
      <div className="container mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
              Need Help?
              <br />
              <span className="text-muted-foreground/70">
                We&apos;re here to assist.
              </span>
            </h2>
            <p className="text-base text-muted-foreground sm:text-lg md:text-xl">
              Still have questions? Feel free to contact our friendly
              <a href="#" className="mx-1 whitespace-nowrap underline">
                support team
              </a>
              specialists.
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
