"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

import ContactForm from "@/components/home/components/ContactForm";

const contactInfo = [
  {
    icon: "solar:letter-bold-duotone",
    title: "Email",
    description: "hey@meyoo.io",
    link: "mailto:hey@meyoo.io",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-default-200/70 to-transparent dark:via-default-100/40" />
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 bg-content1/70 dark:bg-content1/50 backdrop-blur-md border border-divider rounded-full px-5 py-2.5 mb-6">
            <Icon
              className="text-primary"
              icon="solar:phone-bold-duotone"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Contact Us
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Contact</h1>
          <p className="text-xl text-default-600">
            Questions about profit tracking? Let us know.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {contactInfo.map((item) => (
              <Card
                key={item.title}
                className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none transition-transform hover:-translate-y-0.5"
              >
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon
                        className="text-primary"
                        icon={item.icon}
                        width={24}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">
                        {item.title}
                      </h3>
                      <p className="text-default-600 text-sm mb-3">
                        {item.description}
                      </p>
                      {item.link && (
                        <Link
                          className="text-primary text-sm font-medium hover:underline inline-flex items-center gap-1"
                          href={item.link}
                        >
                          Contact via {item.title}
                          <Icon
                            className="w-4 h-4"
                            icon="solar:arrow-right-up-linear"
                          />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {/* Contact Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Form */}
            <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
              <CardBody className="p-8">
                <h2 className="text-2xl font-bold mb-6">Send Message</h2>
                <ContactForm />
              </CardBody>
            </Card>

            {/* FAQ Section */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>

              <div className="space-y-4">
                <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-2">
                      What&apos;s the response time?
                    </h3>
                    <p className="text-default-600 text-sm">
                      We typically respond to all inquiries within 24 hours
                      during business days. Priority support customers receive
                      responses within 4 hours.
                    </p>
                  </CardBody>
                </Card>

                <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-2">Do you offer demos?</h3>
                    <p className="text-default-600 text-sm">
                      Yes! We offer personalized demos for qualified businesses.
                      Select &quot;Sales Inquiry&quot; as your reason for
                      contact to schedule one.
                    </p>
                  </CardBody>
                </Card>

                <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-2">
                      Is there phone support?
                    </h3>
                    <p className="text-default-600 text-sm">
                      Phone support is available for Enterprise customers. All
                      other plans include email and live chat support.
                    </p>
                  </CardBody>
                </Card>
              </div>

              <Divider className="my-8" />

              <div className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Icon
                    className="w-5 h-5 text-primary"
                    icon="solar:buildings-2-bold-duotone"
                  />
                  Office Location
                </h3>
                <p className="text-default-600 text-sm">
                  Pyro Labs Private Limited
                  <br />
                  (Operating as Meyoo)
                  <br />
                  Noida, Uttar Pradesh
                  <br />
                  India
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
