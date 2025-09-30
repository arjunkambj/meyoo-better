"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import CTAButton from "@/components/home/components/CTAButton";
import EmailButton from "@/components/home/components/EmailButton";

const dataWeCollect = [
  {
    icon: "solar:shop-bold-duotone",
    title: "Shopify Store Data",
    items: [
      "Store name, domain, and email",
      "Product catalogs and inventory",
      "Order and transaction history",
      "Customer analytics (aggregated)",
    ],
  },
  {
    icon: "solar:chart-bold-duotone",
    title: "Marketing Data",
    items: [
      "Meta advertising campaigns",
      "Google Ads performance",
      "Ad spend and impressions",
      "Campaign ROI metrics",
    ],
  },
  {
    icon: "solar:database-bold-duotone",
    title: "Analytics Data",
    items: [
      "Calculated profit metrics",
      "Performance reports",
      "Dashboard preferences",
      "Custom cost configurations",
    ],
  },
];

const deletionSteps = [
  {
    number: "1",
    title: "Uninstall the Meyoo app",
    description: "From your Shopify admin panel",
    icon: "solar:smartphone-bold-duotone",
  },
  {
    number: "2",
    title: "Email us",
    description:
      'Send request to hey@meyoo.io with subject "Data Deletion Request"',
    icon: "solar:letter-bold-duotone",
  },
  {
    number: "3",
    title: "Include your store",
    description: "Provide your Shopify store domain",
    icon: "solar:shop-bold-duotone",
  },
  {
    number: "4",
    title: "We'll process it",
    description: "Within 30 days maximum",
    icon: "solar:clock-circle-bold-duotone",
  },
];

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-default-200/70 to-transparent dark:via-default-100/40" />
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 bg-content1/70 dark:bg-content1/50 backdrop-blur-md border border-divider rounded-full px-5 py-2.5 mb-6">
            <Icon
              className="text-danger"
              icon="solar:trash-bin-trash-bold-duotone"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Data Deletion
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Data Deletion Instructions
          </h1>
          <p className="text-xl text-default-600">
            Control your data. Delete it anytime.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Introduction */}
          <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none mb-12">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:shield-check-bold-duotone"
                />
                Your Privacy Matters
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  Meyoo is a profit intelligence platform that helps e-commerce
                  merchants track their profitability by combining data from
                  Shopify, Meta Ads, Google Ads, and other sources.
                </p>
                <p>
                  We respect your right to privacy and data control. You can
                  request complete deletion of your data at any time. This page
                  explains what data we collect and how to request its deletion.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* What Data We Collect */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">What Data We Collect</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dataWeCollect.map((category) => (
                <Card
                  key={category.title}
                  className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none transition-transform hover:-translate-y-0.5"
                >
                  <CardBody className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon
                        className="w-6 h-6 text-primary"
                        icon={category.icon}
                      />
                    </div>
                    <h3 className="font-semibold mb-3">{category.title}</h3>
                    <ul className="space-y-2">
                      {category.items.map((item) => (
                        <li
                          key={item}
                          className="text-sm text-default-600 flex items-start gap-2"
                        >
                          <Icon
                            className="w-4 h-4 text-primary mt-0.5"
                            icon="solar:check-circle-bold-duotone"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ))}
            </div>
            <Card className="bg-success-50 dark:bg-success-100/10 border border-success-200 dark:border-success-200/20 rounded-2xl shadow-none mt-6">
              <CardBody className="p-6">
                <div className="flex gap-3">
                  <Icon
                    className="w-5 h-5 text-success shrink-0 mt-0.5"
                    icon="solar:shield-user-bold-duotone"
                  />
                  <div>
                    <h4 className="font-semibold mb-2">Privacy First</h4>
                    <p className="text-sm text-default-700">
                      We never store personal customer information. All customer
                      data is aggregated and anonymized for analytics purposes
                      only.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12" />

          {/* How to Request Data Deletion */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">
              How to Request Data Deletion
            </h2>
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl shadow-none mb-8">
              <CardBody className="p-8">
                <p className="text-default-700 mb-6">
                  To request complete deletion of your data from Meyoo, follow
                  these simple steps:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {deletionSteps.map((step) => (
                    <div key={step.number} className="text-center">
                      <div className="w-16 h-16 rounded-full bg-content1/80 dark:bg-content1/70 backdrop-blur-md border border-divider flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl font-bold text-primary">
                          {step.number}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-1">{step.title}</h3>
                      <p className="text-sm text-default-600">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:letter-bold-duotone"
                    />
                    Email Template
                  </h3>
                  <div className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-lg p-4 font-mono text-sm">
                    <p className="text-default-600">To: hey@meyoo.io</p>
                    <p className="text-default-600">
                      Subject: Data Deletion Request
                    </p>
                    <br />
                    <p className="text-default-700">
                      Hi Meyoo Team,
                      <br />
                      <br />I would like to request deletion of all data
                      associated with my Shopify store:
                      <br />
                      <br />
                      Store Domain: [your-store.myshopify.com]
                      <br />
                      <br />
                      Thank you
                    </p>
                  </div>
                </CardBody>
              </Card>

              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:clock-circle-bold-duotone"
                    />
                    Processing Time
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <Icon
                        className="w-5 h-5 text-success mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <div>
                        <p className="font-medium text-sm">Acknowledgment</p>
                        <p className="text-sm text-default-600">
                          Within 24 hours
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Icon
                        className="w-5 h-5 text-warning mt-0.5"
                        icon="solar:hourglass-bold-duotone"
                      />
                      <div>
                        <p className="font-medium text-sm">Processing</p>
                        <p className="text-sm text-default-600">
                          Up to 30 days
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Icon
                        className="w-5 h-5 text-primary mt-0.5"
                        icon="solar:letter-bold-duotone"
                      />
                      <div>
                        <p className="font-medium text-sm">Confirmation</p>
                        <p className="text-sm text-default-600">
                          Email notification when complete
                        </p>
                      </div>
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>

          <Divider className="my-12" />

          {/* What Gets Deleted */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">What Gets Deleted</h2>
            <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
              <CardBody className="p-8">
                <p className="text-default-700 mb-6">
                  When you request data deletion, we remove:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon
                        className="w-5 h-5 text-danger"
                        icon="solar:trash-bin-trash-bold-duotone"
                      />
                      Permanently Deleted
                    </h3>
                    <ul className="space-y-2">
                      <li className="text-sm text-default-600 flex items-start gap-2">
                        <Icon
                          className="w-4 h-4 text-danger mt-0.5"
                          icon="solar:close-circle-bold-duotone"
                        />
                        <span>All store information and settings</span>
                      </li>
                      <li className="text-sm text-default-600 flex items-start gap-2">
                        <Icon
                          className="w-4 h-4 text-danger mt-0.5"
                          icon="solar:close-circle-bold-duotone"
                        />
                        <span>Imported marketing and ad data</span>
                      </li>
                      <li className="text-sm text-default-600 flex items-start gap-2">
                        <Icon
                          className="w-4 h-4 text-danger mt-0.5"
                          icon="solar:close-circle-bold-duotone"
                        />
                        <span>Order and transaction history</span>
                      </li>
                      <li className="text-sm text-default-600 flex items-start gap-2">
                        <Icon
                          className="w-4 h-4 text-danger mt-0.5"
                          icon="solar:close-circle-bold-duotone"
                        />
                        <span>Calculated metrics and reports</span>
                      </li>
                      <li className="text-sm text-default-600 flex items-start gap-2">
                        <Icon
                          className="w-4 h-4 text-danger mt-0.5"
                          icon="solar:close-circle-bold-duotone"
                        />
                        <span>OAuth tokens and credentials</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon
                        className="w-5 h-5 text-warning"
                        icon="solar:calendar-bold-duotone"
                      />
                      Retention Period
                    </h3>
                    <div className="space-y-4">
                      <Card className="bg-warning-50 dark:bg-warning-100/10 border border-warning-200 dark:border-warning-200/20 rounded-2xl shadow-none">
                        <CardBody className="p-4">
                          <p className="text-sm text-default-700">
                            <strong>Backup retention:</strong> Data may remain
                            in backups for up to 90 days after deletion for
                            disaster recovery purposes.
                          </p>
                        </CardBody>
                      </Card>
                      <Card className="bg-info-50 dark:bg-info-100/10 border border-info-200 dark:border-info-200/20 rounded-2xl shadow-none">
                        <CardBody className="p-4">
                          <p className="text-sm text-default-700">
                            <strong>Immediate removal:</strong> Your data is
                            immediately marked for deletion and becomes
                            inaccessible in our production systems.
                          </p>
                        </CardBody>
                      </Card>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12" />

          {/* Platform-Specific Data Deletion Procedures */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">
              Platform-Specific Data Deletion Procedures
            </h2>
            <div className="space-y-6">
              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:shop-bold-duotone"
                    />
                    Shopify Data Deletion Procedures
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    When you request data deletion, we automatically handle
                    Shopify-specific requirements:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>
                      • Webhook deregistration from your Shopify store within 24
                      hours
                    </li>
                    <li>
                      • Complete removal of all OAuth tokens and store
                      credentials
                    </li>
                    <li>
                      • Deletion of all imported product, order, and customer
                      data
                    </li>
                    <li>
                      • Compliance with Shopify Partner Program data handling
                      requirements
                    </li>
                    <li>
                      • GDPR webhook compliance for merchant data protection
                    </li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:facebook-bold-duotone"
                    />
                    Meta Platform Data Deletion
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    For Meta/Facebook data, our deletion process includes:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>
                      • Immediate revocation of all Facebook Marketing API
                      access tokens
                    </li>
                    <li>
                      • Complete removal of all imported ad campaign data and
                      metrics
                    </li>
                    <li>
                      • Deletion of Instagram business account data and insights
                    </li>
                    <li>
                      • Data deletion callback confirmation to Meta&apos;s
                      systems
                    </li>
                    <li>
                      • Compliance with Meta Platform Terms and app review
                      policies
                    </li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:verified-check-bold-duotone"
                    />
                    Google Ads Data Deletion
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    Google Ads API data deletion procedures include:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>
                      • Revocation of all Google Ads API refresh and access
                      tokens
                    </li>
                    <li>
                      • Complete removal of campaign performance data and
                      metrics
                    </li>
                    <li>
                      • Deletion of customer data upload lists and audience
                      information
                    </li>
                    <li>
                      • Compliance with Google Ads API Terms of Service data
                      retention policies
                    </li>
                    <li>
                      • Implementation of Required Minimum Functionality (RMF)
                      for data deletion
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>

          <Divider className="my-12" />

          {/* Compliance */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Legal Compliance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="tabler:brand-europa"
                    />
                    GDPR & Privacy Laws
                  </h3>
                  <p className="text-sm text-default-600 mb-3">
                    We comply with GDPR and other data protection regulations:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>Right to erasure (Right to be forgotten)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>Transparent data handling</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>Timely response to requests</span>
                    </li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:document-text-bold-duotone"
                    />
                    Platform Requirements
                  </h3>
                  <p className="text-sm text-default-600 mb-3">
                    This page meets all platform compliance requirements:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>Clear deletion instructions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>30-day processing commitment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon
                        className="w-4 h-4 text-primary mt-0.5"
                        icon="solar:check-circle-bold-duotone"
                      />
                      <span>Platform-specific procedures</span>
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Contact Information */}
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl shadow-none">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:phone-bold-duotone"
                />
                Contact Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold mb-3">Quick Contact</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Icon
                        className="w-5 h-5 text-primary"
                        icon="solar:letter-bold-duotone"
                      />
                      <span>
                        Email:{" "}
                        <Link
                          className="text-primary hover:underline"
                          href="mailto:hey@meyoo.io"
                        >
                          hey@meyoo.io
                        </Link>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon
                        className="w-5 h-5 text-primary"
                        icon="solar:smartphone-bold-duotone"
                      />
                      <span>App: Meyoo - Profit Intelligence</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon
                        className="w-5 h-5 text-primary"
                        icon="solar:clock-circle-bold-duotone"
                      />
                      <span>Response: Within 30 days</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Legal Entity</h3>
                  <p className="text-default-700">
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
              <Divider className="my-6" />
              <div className="flex flex-wrap gap-4">
                <EmailButton
                  email="hey@meyoo.io"
                  size="lg"
                  subject="Data Deletion Request"
                >
                  Request Data Deletion
                </EmailButton>
                <CTAButton
                  href="/privacy/policy"
                  size="lg"
                  startIcon="solar:document-text-bold-duotone"
                  variant="bordered"
                >
                  Privacy Policy
                </CTAButton>
              </div>
            </CardBody>
          </Card>

          {/* Last Updated */}
          <div className="text-center mt-8">
            <p className="text-sm text-default-500">
              This page was last updated on{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
