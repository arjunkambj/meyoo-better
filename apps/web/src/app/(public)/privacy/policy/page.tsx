"use client";
import { Card, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import Link from "next/link";
import { Icon } from "@iconify/react";

const lastUpdated = "January 15, 2025";

const sections = [
  {
    id: "overview",
    title: "Overview",
    icon: "solar:shield-check-bold-duotone",
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    icon: "solar:database-bold-duotone",
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    icon: "solar:settings-bold-duotone",
  },
  {
    id: "data-sharing",
    title: "Data Sharing & Disclosure",
    icon: "solar:share-bold-duotone",
  },
  {
    id: "third-party",
    title: "Third-Party Integrations",
    icon: "solar:link-bold-duotone",
  },
  {
    id: "data-security",
    title: "Data Security",
    icon: "solar:lock-keyhole-bold-duotone",
  },
  {
    id: "your-rights",
    title: "Your Rights",
    icon: "solar:user-check-bold-duotone",
  },
  {
    id: "shopify-compliance",
    title: "Shopify App Compliance",
    icon: "solar:shop-bold-duotone",
  },
  {
    id: "meta-compliance",
    title: "Meta Platform Compliance",
    icon: "logos:meta-icon",
  },
  {
    id: "gdpr-ccpa",
    title: "GDPR & CCPA Compliance",
    icon: "solar:document-text-bold-duotone",
  },
  {
    id: "google-ads-compliance",
    title: "Google Ads API Compliance",
    icon: "solar:verified-check-bold-duotone",
  },
  {
    id: "shopify-compliance-enhanced",
    title: "Shopify Partner Program Compliance",
    icon: "solar:shop-bold-duotone",
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    icon: "solar:cookie-bold-duotone",
  },
  {
    id: "contact",
    title: "Contact Information",
    icon: "solar:phone-bold-duotone",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-default-200/70 to-transparent dark:via-default-100/40" />
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-xl text-default-600">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Table of Contents */}
          <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none mb-12">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-4">Table of Contents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-content2 transition-colors text-default-700 hover:text-primary"
                    href={`#${section.id}`}
                  >
                    <Icon className="w-4 h-4" icon={section.icon} />
                    <span className="text-sm">{section.title}</span>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Privacy Policy Content */}
          <div className="space-y-12">
            {/* Overview */}
            <section id="overview">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:shield-check-bold-duotone"
                />
                Overview
              </h2>
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <p className="text-default-700 mb-4">
                  Meyoo (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
                  operated by Pyro Labs Private Limited, is committed to
                  protecting your privacy. This Privacy Policy explains how we
                  collect, use, disclose, and safeguard your information when
                  you use our profit intelligence platform for e-commerce
                  businesses.
                </p>
                <p className="text-default-700 mb-4">
                  By using Meyoo, you agree to the collection and use of
                  information in accordance with this policy. If you do not
                  agree with the terms of this privacy policy, please do not
                  access the platform.
                </p>
              </div>
            </section>

            <Divider />

            {/* Information We Collect */}
            <section id="information-we-collect">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:database-bold-duotone"
                />
                Information We Collect
              </h2>
              <div className="space-y-4">
                <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Account Information</h3>
                    <ul className="space-y-2 text-default-700 text-sm">
                      <li>• Name, email address, and password</li>
                      <li>• Business name and industry</li>
                      <li>• Billing information and payment details</li>
                      <li>• Phone number (optional)</li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Business Data</h3>
                    <ul className="space-y-2 text-default-700 text-sm">
                      <li>
                        • Shopify store data (products, orders, customers,
                        inventory)
                      </li>
                      <li>
                        • Meta advertising data (campaigns, ad performance,
                        spend)
                      </li>
                      <li>• Logistics and shipping information</li>
                      <li>• Financial metrics and cost data you provide</li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Usage Data</h3>
                    <ul className="space-y-2 text-default-700 text-sm">
                      <li>
                        • Log data (IP address, browser type, pages visited)
                      </li>
                      <li>• Device information and identifiers</li>
                      <li>• Feature usage and interaction data</li>
                      <li>• Performance and diagnostic data</li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* How We Use Your Information */}
            <section id="how-we-use">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:settings-bold-duotone"
                />
                How We Use Your Information
              </h2>
              <div className="space-y-3 text-default-700">
                <p>
                  We use the collected information for the following purposes:
                </p>
                <ul className="space-y-2 ml-4">
                  <li>
                    • <strong>Service Delivery:</strong> To provide profit
                    analytics, insights, and recommendations
                  </li>
                  <li>
                    • <strong>Integration Management:</strong> To connect and
                    sync with your Shopify store and Meta ads
                  </li>
                  <li>
                    • <strong>Communication:</strong> To send service updates,
                    alerts, and support messages
                  </li>
                  <li>
                    • <strong>Improvement:</strong> To enhance our platform
                    features and user experience
                  </li>
                  <li>
                    • <strong>Security:</strong> To detect and prevent fraud,
                    abuse, and security incidents
                  </li>
                  <li>
                    • <strong>Compliance:</strong> To meet legal obligations
                    and enforce our terms
                  </li>
                  <li>
                    • <strong>Analytics:</strong> To understand usage patterns
                    and optimize performance
                  </li>
                </ul>
              </div>
            </section>

            <Divider />

            {/* Data Sharing & Disclosure */}
            <section id="data-sharing">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:share-bold-duotone"
                />
                Data Sharing & Disclosure
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  We do not sell, trade, or rent your personal information. We
                  may share your information only in the following
                  circumstances:
                </p>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Service Providers</h3>
                    <p className="text-sm">
                      We share data with trusted third-party service providers
                      who assist us in operating our platform, including:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm ml-4">
                      <li>• Cloud hosting providers (AWS)</li>
                      <li>• Payment processors (Stripe)</li>
                      <li>• Email service providers</li>
                      <li>• Analytics tools (with anonymized data)</li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Legal Requirements</h3>
                    <p className="text-sm">
                      We may disclose information if required by law, court
                      order, or government regulation, or if we believe
                      disclosure is necessary to protect rights, property, or
                      safety.
                    </p>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Business Transfers</h3>
                    <p className="text-sm">
                      In the event of a merger, acquisition, or sale of assets,
                      your information may be transferred to the successor
                      entity.
                    </p>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* Third-Party Integrations */}
            <section id="third-party">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:link-bold-duotone"
                />
                Third-Party Integrations
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  Meyoo integrates with third-party platforms to provide our
                  services:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">Shopify</h3>
                      <p className="text-sm mb-2">We access:</p>
                      <ul className="space-y-1 text-sm ml-4">
                        <li>• Store information</li>
                        <li>• Product catalogs</li>
                        <li>• Order data</li>
                        <li>• Customer information</li>
                        <li>• Inventory levels</li>
                      </ul>
                    </CardBody>
                  </Card>

                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">Meta (Facebook)</h3>
                      <p className="text-sm mb-2">We access:</p>
                      <ul className="space-y-1 text-sm ml-4">
                        <li>• Ad account information</li>
                        <li>• Campaign performance</li>
                        <li>• Ad spend data</li>
                        <li>• Audience insights</li>
                        <li>• Creative assets</li>
                      </ul>
                    </CardBody>
                  </Card>
                </div>

                <p className="text-sm text-default-600">
                  Each integration requires your explicit authorization. You can
                  revoke access at any time through your account settings.
                </p>
              </div>
            </section>

            <Divider />

            {/* Data Security */}
            <section id="data-security">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:lock-keyhole-bold-duotone"
                />
                Data Security
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  We implement industry-standard security measures to protect
                  your data:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">
                        Technical Safeguards
                      </h3>
                      <ul className="space-y-1 text-sm">
                        <li>• 256-bit SSL encryption</li>
                        <li>• Encrypted data storage</li>
                        <li>• Regular security audits</li>
                        <li>• Secure API endpoints</li>
                      </ul>
                    </CardBody>
                  </Card>

                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">
                        Operational Security
                      </h3>
                      <ul className="space-y-1 text-sm">
                        <li>• Access controls and authentication</li>
                        <li>• Regular backups</li>
                        <li>• Incident response procedures</li>
                        <li>• Employee training</li>
                      </ul>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </section>

            <Divider />

            {/* Your Rights */}
            <section id="your-rights">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:user-check-bold-duotone"
                />
                Your Rights
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  You have the following rights regarding your personal
                  information:
                </p>

                <div className="space-y-3 transition-transform">
                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-2">
                        Access & Portability
                      </h3>
                      <p className="text-sm">
                        Request a copy of your personal data in a structured,
                        machine-readable format.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-content2 border border-divider shadow-none">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-2">Correction</h3>
                      <p className="text-sm">
                        Update or correct inaccurate personal information.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-content2 border border-divider shadow-none">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-2">Deletion</h3>
                      <p className="text-sm">
                        Request deletion of your personal data, subject to legal
                        retention requirements.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-content2 border border-divider shadow-none">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-2">Restriction</h3>
                      <p className="text-sm">
                        Limit how we process your personal information.
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-content2 border border-divider shadow-none">
                    <CardBody className="p-4">
                      <h3 className="font-semibold mb-2">Objection</h3>
                      <p className="text-sm">
                        Object to certain processing activities, including
                        marketing communications.
                      </p>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </section>

            <Divider />

            {/* Shopify App Compliance */}
            <section id="shopify-compliance">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:shop-bold-duotone"
                />
                Shopify App Compliance
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  As a Shopify app, we comply with Shopify&apos;s API License
                  and Terms of Use:
                </p>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Data Usage Limitations
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We only access data necessary for providing our
                        services
                      </li>
                      <li>
                        • Customer data is used solely for analytics and
                        insights
                      </li>
                      <li>• We do not contact your customers directly</li>
                      <li>
                        • We do not share your Shopify data with other
                        merchants
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Mandatory Webhooks</h3>
                    <p className="text-sm mb-2">
                      We support Shopify&apos;s mandatory GDPR webhooks:
                    </p>
                    <ul className="space-y-1 text-sm ml-4">
                      <li>• Customer data request</li>
                      <li>• Customer redaction</li>
                      <li>• Shop redaction</li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* Meta Platform Compliance */}
            <section id="meta-compliance">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="logos:meta-icon"
                />
                Meta Platform Compliance
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  We comply with Meta&apos;s Platform Terms, Developer Policies,
                  and Marketing API requirements:
                </p>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Facebook Marketing API Compliance
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We only request permissions necessary for our
                        services
                      </li>
                      <li>
                        • Ad data is used exclusively for analytics and
                        reporting
                      </li>
                      <li>
                        • We do not store Meta user passwords or credentials
                      </li>
                      <li>
                        • We comply with Meta&apos;s data retention and
                        deletion policies
                      </li>
                      <li>
                        • We follow all Facebook Business SDK guidelines and
                        best practices
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Instagram Data Handling
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • Instagram advertising data is processed only for
                        campaign analytics
                      </li>
                      <li>
                        • We do not access personal Instagram content or
                        profiles
                      </li>
                      <li>
                        • Instagram data is subject to the same security
                        measures as Facebook data
                      </li>
                      <li>
                        • We comply with Instagram Platform Policy
                        requirements
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">Prohibited Uses</h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We do not sell or transfer Meta data to third
                        parties
                      </li>
                      <li>
                        • We do not use data for surveillance or
                        discriminatory purposes
                      </li>
                      <li>
                        • We do not create derivative databases from Meta data
                      </li>
                      <li>
                        • We do not use data for any purpose outside of our
                        stated services
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Policy Violation Handling
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We monitor compliance with Meta Platform Policies
                        continuously
                      </li>
                      <li>
                        • Policy violations are addressed immediately upon
                        detection
                      </li>
                      <li>
                        • We maintain procedures for policy exemption requests
                        when applicable
                      </li>
                      <li>
                        • Users are notified of any policy-related issues
                        affecting their data
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* GDPR & CCPA Compliance */}
            <section id="gdpr-ccpa">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:document-text-bold-duotone"
                />
                GDPR & CCPA Compliance
              </h2>
              <div className="space-y-4">
                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      GDPR (European Users)
                    </h3>
                    <ul className="space-y-2 text-sm text-default-700">
                      <li>
                        • <strong>Legal Basis:</strong> Legitimate interests
                        and consent
                      </li>
                      <li>
                        • <strong>Data Controller:</strong> Pyro Labs Private
                        Limited
                      </li>
                      <li>
                        • <strong>Data Retention:</strong> As long as account
                        is active + 90 days
                      </li>
                      <li>
                        • <strong>International Transfers:</strong> Standard
                        contractual clauses
                      </li>
                      <li>
                        • <strong>DPO Contact:</strong> hey@meyoo.io
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      CCPA (California Residents)
                    </h3>
                    <ul className="space-y-2 text-sm text-default-700">
                      <li>
                        • <strong>Right to Know:</strong> Request disclosure
                        of data collected
                      </li>
                      <li>
                        • <strong>Right to Delete:</strong> Request deletion
                        of personal information
                      </li>
                      <li>
                        • <strong>Right to Opt-Out:</strong> We do not sell
                        personal information
                      </li>
                      <li>
                        • <strong>Non-Discrimination:</strong> Equal service
                        regardless of privacy choices
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* Google Ads API Compliance */}
            <section id="google-ads-compliance">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:verified-check-bold-duotone"
                />
                Google Ads API Compliance
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  We comply with Google Ads API Terms of Service, Developer
                  Policies, and Required Minimum Functionality (RMF)
                  requirements:
                </p>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Google Ads API Data Usage
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We access Google Ads data solely for campaign
                        management and reporting
                      </li>
                      <li>
                        • Customer data is processed according to
                        Google&apos;s Customer Data Usage policies
                      </li>
                      <li>
                        • We implement required minimum functionality for app
                        campaign management
                      </li>
                      <li>
                        • All data requests comply with Google Ads API rate
                        limits and quotas
                      </li>
                      <li>
                        • We maintain appropriate OAuth2 scope limitations
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Customer Data Upload Policies
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We only upload first-party customer data that you
                        have collected directly
                      </li>
                      <li>
                        • Customer Match data is hashed and encrypted before
                        transmission
                      </li>
                      <li>
                        • We comply with minimum user thresholds for
                        remarketing audiences
                      </li>
                      <li>
                        • User consent is verified before any data upload to
                        Google Ads
                      </li>
                      <li>
                        • Customer data is limited to email addresses, phone
                        numbers, and names only
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Data Retention & Deletion
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • Google Ads data is retained only as long as
                        necessary for service provision
                      </li>
                      <li>
                        • Campaign data is deleted within 90 days of account
                        disconnection
                      </li>
                      <li>
                        • Customer audience data is removed immediately upon
                        request
                      </li>
                      <li>
                        • We comply with Google&apos;s data retention limits
                        for different data types
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Policy Exemptions & Violations
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We implement policy validation parameter handling
                        for ad creatives
                      </li>
                      <li>
                        • Policy violation exemptions are requested only when
                        appropriate
                      </li>
                      <li>
                        • We maintain procedures for handling policy finding
                        errors
                      </li>
                      <li>
                        • All campaign modifications comply with Google Ads
                        content policies
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* Shopify Partner Program Compliance */}
            <section id="shopify-compliance-enhanced">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:shop-bold-duotone"
                />
                Shopify Partner Program Compliance
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  We comply with Shopify Partner Program requirements, App Store
                  policies, and merchant data protection standards:
                </p>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Merchant Data Protection
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • Merchant store data is accessed only with explicit
                        consent and proper scopes
                      </li>
                      <li>
                        • We do not access customer personal information
                        beyond what&apos;s necessary for analytics
                      </li>
                      <li>
                        • All customer data is aggregated and anonymized for
                        reporting purposes
                      </li>
                      <li>
                        • We do not contact merchants&apos; customers directly
                      </li>
                      <li>
                        • Store data is not shared with other merchants or
                        third parties
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      App Review & Audit Procedures
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We maintain compliance with Shopify App Store review
                        guidelines
                      </li>
                      <li>
                        • Our app undergoes regular security audits and
                        updates
                      </li>
                      <li>
                        • We respond to Shopify audit requests within required
                        timeframes
                      </li>
                      <li>
                        • App functionality changes are submitted for review
                        when required
                      </li>
                      <li>
                        • We maintain detailed documentation for compliance
                        verification
                      </li>
                    </ul>
                  </CardBody>
                </Card>

                <Card className="bg-content2 border border-divider shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-3">
                      Webhook & API Compliance
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li>
                        • We implement all mandatory GDPR webhooks (customer
                        data request, redaction, shop redaction)
                      </li>
                      <li>
                        • Webhook endpoints respond within Shopify&apos;s
                        required timeframes
                      </li>
                      <li>
                        • API usage complies with Shopify&apos;s rate limits
                        and best practices
                      </li>
                      <li>
                        • We validate webhook authenticity using
                        Shopify&apos;s verification methods
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </section>

            <Divider />

            {/* Cookies & Tracking */}
            <section id="cookies">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:cookie-bold-duotone"
                />
                Cookies & Tracking
              </h2>
              <div className="space-y-4 text-default-700">
                <p>We use cookies and similar technologies to:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">Essential Cookies</h3>
                      <ul className="space-y-1 text-sm">
                        <li>• Authentication and security</li>
                        <li>• User preferences</li>
                        <li>• Session management</li>
                      </ul>
                    </CardBody>
                  </Card>

                  <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-3">Analytics Cookies</h3>
                      <ul className="space-y-1 text-sm">
                        <li>• Usage patterns (anonymized)</li>
                        <li>• Performance monitoring</li>
                        <li>• Feature adoption tracking</li>
                      </ul>
                    </CardBody>
                  </Card>
                </div>

                <p className="text-sm">
                  You can control cookies through your browser settings.
                  Disabling certain cookies may limit functionality.
                </p>
              </div>
            </section>

            <Divider />

            {/* Contact Information */}
            <section id="contact">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:phone-bold-duotone"
                />
                Contact Information
              </h2>
              <div className="space-y-4">
                <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <p className="text-default-700 mb-4">
                      For privacy-related questions, requests, or complaints,
                      please contact us:
                    </p>

                    <div className="space-y-3 text-sm">
                      <div>
                        <strong>Email:</strong>{" "}
                        <Link
                          className="text-primary"
                          href="mailto:hey@meyoo.io"
                        >
                          hey@meyoo.io
                        </Link>
                      </div>

                      <div>
                        <strong>Mail:</strong>
                        <br />
                        Pyro Labs Private Limited
                        <br />
                        (Operating as Meyoo)
                        <br />
                        Attn: Privacy Officer
                        <br />
                        Noida, Uttar Pradesh
                        <br />
                        India
                      </div>

                      <div>
                        <strong>Response Time:</strong> We aim to respond to all
                        privacy requests within 30 days.
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="bg-warning-50 dark:bg-warning-100/10 border border-warning-200 dark:border-warning-200/20 rounded-2xl shadow-none">
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Icon
                        className="w-5 h-5 text-warning"
                        icon="solar:info-circle-bold-duotone"
                      />
                      Policy Updates
                    </h3>
                    <p className="text-sm text-default-700">
                      We may update this Privacy Policy periodically. Material
                      changes will be notified via email or platform
                      notification. Continued use after changes constitutes
                      acceptance of the updated policy.
                    </p>
                  </CardBody>
                </Card>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
