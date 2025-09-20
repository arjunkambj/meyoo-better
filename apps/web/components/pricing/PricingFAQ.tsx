"use client";

import { Accordion, AccordionItem } from "@heroui/react";
import { Icon } from "@iconify/react";

const faqs = [
  {
    question: "How does the 14-day free trial work?",
    answer:
      "All paid plans include a 14-day free trial. You can explore all features without any charges. Your billing starts only after the trial ends, and you can cancel anytime during the trial period.",
  },
  {
    question: "What happens if I exceed my plan's order limit?",
    answer:
      "We charge a small fee per extra order based on your plan. Starter: $0.20/order (max $299), Growth: $0.10/order (max $399), Business: $0.05/order (max $499). The overage caps protect you from unexpected bills.",
  },
  {
    question: "Can I change plans anytime?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the next billing cycle.",
  },
  {
    question: "How does yearly billing work?",
    answer:
      "With yearly billing, you pay for 10 months and get 12 months of service - that's 2 months free! You're billed once per year, and you can still change plans if needed.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We process all payments through Shopify's billing system, which accepts major credit cards. Your subscription appears on your regular Shopify invoice for convenience.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 14-day free trial so you can test Meyoo risk-free. After the trial, we don't offer refunds for partial months, but you can cancel anytime to prevent future charges.",
  },
  {
    question: "What counts as an 'order'?",
    answer:
      "An order is any completed purchase in your Shopify store, including fulfilled, partially fulfilled, and pending orders. Cancelled and refunded orders don't count toward your limit.",
  },
  {
    question: "Can I add more team members?",
    answer:
      "Yes! Each plan includes free team members (3-10 depending on plan). Additional team members are $10/month each and include AI features.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your data remains accessible for 30 days after cancellation, giving you time to export anything you need. After 30 days, data is permanently deleted in compliance with privacy regulations.",
  },
  {
    question: "Do you offer custom plans for large stores?",
    answer:
      "For stores processing more than 10,000 orders/month, we offer custom Enterprise plans with volume discounts, dedicated support, and custom features. Contact our sales team for details.",
  },
];

export default function PricingFAQ() {
  return (
    <div className="max-w-3xl mx-auto">
      <Accordion
        itemClasses={{
          base: "shadow-none border border-default-200 hover:border-default-300 transition-colors",
          title: "text-sm font-medium",
          content: "text-sm text-default-600",
        }}
        variant="splitted"
      >
        {faqs.map((faq, _index) => (
          <AccordionItem
            key={faq.question}
            aria-label={faq.question}
            startContent={
              <Icon
                className="text-primary"
                icon="solar:question-circle-bold"
                width={20}
              />
            }
            title={faq.question}
          >
            {faq.answer}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
