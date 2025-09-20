"use client";
import { Card, CardBody, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

const lastUpdated = "January 15, 2025";

const cookieTypes = [
  {
    icon: "solar:shield-check-bold-duotone",
    title: "Essential Cookies",
    description: "Required for the website to function properly",
    examples: [
      "Authentication tokens to keep you logged in",
      "Security cookies to protect your account",
      "User preferences and settings",
      "Session management for your dashboard",
    ],
    canDisable: false,
  },
  {
    icon: "solar:chart-bold-duotone",
    title: "Analytics Cookies",
    description: "Help us understand how you use Meyoo",
    examples: [
      "Anonymous usage statistics",
      "Feature adoption tracking",
      "Performance monitoring",
      "Error tracking for debugging",
    ],
    canDisable: true,
  },
  {
    icon: "solar:settings-bold-duotone",
    title: "Functional Cookies",
    description: "Enable enhanced functionality and personalization",
    examples: [
      "Language preferences",
      "Time zone settings",
      "Dashboard customizations",
      "Recently viewed items",
    ],
    canDisable: true,
  },
];

const thirdPartyCookies = [
  {
    name: "Shopify",
    purpose: "Store authentication and session management",
    retention: "Session",
  },
  {
    name: "Meta (Facebook)",
    purpose: "Ad account access and campaign data retrieval",
    retention: "90 days",
  },
  {
    name: "Google",
    purpose: "Authentication and Google Ads API access",
    retention: "180 days",
  },
  {
    name: "Stripe",
    purpose: "Payment processing and fraud prevention",
    retention: "1 year",
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-default-200/70 to-transparent dark:via-default-100/40" />
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 bg-content1/70 dark:bg-content1/50 backdrop-blur-md border border-divider rounded-full px-5 py-2.5 mb-6">
            <Icon
              className="text-secondary"
              icon="solar:cookie-bold-duotone"
              width={16}
            />
            <span className="text-sm font-semibold text-default-700">
              Cookie Policy
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Cookie Policy</h1>
          <p className="text-xl text-default-600">
            Last updated: {lastUpdated}
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
                  icon="solar:info-circle-bold-duotone"
                />
                About This Policy
              </h2>
              <div className="space-y-4 text-default-700">
                <p>
                  This Cookie Policy explains how Meyoo (&quot;we&quot;,
                  &quot;us&quot;, or &quot;our&quot;), operated by Pyro Labs
                  Private Limited, uses cookies and similar technologies to
                  recognize you when you visit our platform at meyoo.io.
                </p>
                <p>
                  It explains what these technologies are and why we use them,
                  as well as your rights to control our use of them. This policy
                  should be read in conjunction with our Privacy Policy.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* What Are Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">What Are Cookies?</h2>
            <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none">
              <CardBody className="p-6">
                <p className="text-default-700 mb-4">
                  Cookies are small data files that are placed on your computer
                  or mobile device when you visit a website. Cookies are widely
                  used by website owners to make their websites work, or to work
                  more efficiently, as well as to provide reporting information.
                </p>
                <p className="text-default-700">
                  Cookies set by the website owner (in this case, Meyoo) are
                  called &quot;first party cookies&quot;. Cookies set by parties
                  other than the website owner are called &quot;third party
                  cookies&quot;. Third party cookies enable third party features
                  or functionality to be provided on or through the website
                  (e.g., analytics, interactive content and advertising).
                </p>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12" />

          {/* Types of Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Types of Cookies We Use</h2>
            <div className="space-y-6">
              {cookieTypes.map((type) => (
                <Card
                  key={type.title}
                  className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none transition-transform hover:-translate-y-0.5"
                >
                  <CardBody className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon
                          className="w-6 h-6 text-primary"
                          icon={type.icon}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold">
                            {type.title}
                          </h3>
                          {type.canDisable ? (
                            <span className="text-xs bg-warning/10 text-warning px-3 py-1 rounded-full">
                              Optional
                            </span>
                          ) : (
                            <span className="text-xs bg-success/10 text-success px-3 py-1 rounded-full">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-default-600 mb-3">
                          {type.description}
                        </p>
                        <div className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-lg p-4">
                          <p className="text-sm font-medium mb-2">Examples:</p>
                          <ul className="space-y-1">
                            {type.examples.map((example) => (
                              <li
                                key={example}
                                className="text-sm text-default-600 flex items-start gap-2"
                              >
                                <Icon
                                  className="w-4 h-4 text-primary mt-0.5"
                                  icon="solar:check-circle-bold"
                                />
                                <span>{example}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          <Divider className="my-12" />

          {/* Third-Party Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Third-Party Cookies</h2>
            <Card className="bg-content1/70 dark:bg-content1/40 backdrop-blur-md border border-divider rounded-2xl shadow-none mb-6">
              <CardBody className="p-6">
                <p className="text-default-700 mb-6">
                  We use cookies from trusted third-party services to provide
                  core functionality and integrations. These cookies are
                  essential for connecting your e-commerce platforms and
                  analyzing your data.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-divider">
                        <th className="text-left py-3 px-4 font-semibold">
                          Service
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Purpose
                        </th>
                        <th className="text-left py-3 px-4 font-semibold">
                          Retention
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {thirdPartyCookies.map((cookie) => (
                        <tr
                          key={cookie.name}
                          className="border-b border-default-200/70 dark:border-default-100/60"
                        >
                          <td className="py-3 px-4 text-default-700">
                            {cookie.name}
                          </td>
                          <td className="py-3 px-4 text-default-600 text-sm">
                            {cookie.purpose}
                          </td>
                          <td className="py-3 px-4 text-default-600 text-sm">
                            {cookie.retention}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12" />

          {/* Managing Cookies */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">
              Managing Your Cookie Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:settings-bold-duotone"
                    />
                    Browser Controls
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    Most web browsers allow you to control cookies through their
                    settings:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>• View what cookies are stored</li>
                    <li>• Delete cookies individually or all at once</li>
                    <li>• Block third-party cookies</li>
                    <li>• Block all cookies (may affect functionality)</li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Icon
                      className="w-5 h-5 text-primary"
                      icon="solar:shield-check-bold-duotone"
                    />
                    Our Cookie Settings
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    You can manage your cookie preferences for Meyoo:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>• Essential cookies cannot be disabled</li>
                    <li>• Analytics cookies can be opted out</li>
                    <li>• Functional cookies can be managed</li>
                    <li>• Changes take effect immediately</li>
                  </ul>
                </CardBody>
              </Card>
            </div>

            <Card className="bg-warning-50 dark:bg-warning-100/10 border border-warning-200 dark:border-warning-200/20 rounded-2xl shadow-none mt-6">
              <CardBody className="p-6">
                <div className="flex gap-3">
                  <Icon
                    className="w-5 h-5 text-warning shrink-0 mt-0.5"
                    icon="solar:danger-triangle-bold"
                  />
                  <div>
                    <h4 className="font-semibold mb-2">Important Note</h4>
                    <p className="text-sm text-default-700">
                      Disabling certain cookies may impact the functionality of
                      Meyoo. Essential cookies are required for core features
                      like authentication, data syncing, and security. Without
                      these cookies, you won&apos;t be able to use the platform.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Divider className="my-12" />

          {/* Compliance */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">
              Compliance & Legal Basis
            </h2>
            <div className="space-y-6">
              <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3">
                    GDPR Compliance (EU Users)
                  </h3>
                  <p className="text-default-700 text-sm mb-3">
                    For users in the European Union, we comply with GDPR
                    requirements:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>• We obtain consent for non-essential cookies</li>
                    <li>• You can withdraw consent at any time</li>
                    <li>
                      • We process cookies based on legitimate interests where
                      applicable
                    </li>
                    <li>
                      • Cookie information is included in our privacy policy
                    </li>
                  </ul>
                </CardBody>
              </Card>

              <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-3">Platform Compliance</h3>
                  <p className="text-default-700 text-sm mb-3">
                    Our cookie usage complies with platform requirements:
                  </p>
                  <ul className="space-y-2 text-sm text-default-600">
                    <li>
                      • <strong>Shopify:</strong> Follows Shopify App Store
                      requirements
                    </li>
                    <li>
                      • <strong>Meta:</strong> Complies with Meta Platform
                      Policy
                    </li>
                    <li>
                      • <strong>Google:</strong> Adheres to Google Ads API
                      Terms
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>

          <Divider className="my-12" />

          {/* Updates & Contact */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Updates to This Policy</h2>
            <Card className="bg-white/70 dark:bg-content1/40 backdrop-blur-md border border-default-200/70 dark:border-default-100/60 rounded-2xl shadow-none mb-6">
              <CardBody className="p-6">
                <p className="text-default-700 mb-4">
                  We may update this Cookie Policy from time to time to reflect
                  changes in our practices or for operational, legal, or
                  regulatory reasons. When we make material changes, we will:
                </p>
                <ul className="space-y-2 text-default-700">
                  <li className="flex items-start gap-2">
                    <Icon
                      className="w-4 h-4 text-primary mt-0.5"
                      icon="solar:check-circle-bold"
                    />
                    <span>
                      Update the &quot;Last updated&quot; date at the top of
                      this policy
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      className="w-4 h-4 text-primary mt-0.5"
                      icon="solar:check-circle-bold"
                    />
                    <span>
                      Notify you via email or platform notification for
                      significant changes
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon
                      className="w-4 h-4 text-primary mt-0.5"
                      icon="solar:check-circle-bold"
                    />
                    <span>Request renewed consent where required by law</span>
                  </li>
                </ul>
              </CardBody>
            </Card>
          </div>

          {/* Contact Information */}
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl shadow-none">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon
                  className="w-6 h-6 text-primary"
                  icon="solar:phone-bold-duotone"
                />
                Questions About Cookies?
              </h2>
              <p className="text-default-700 mb-6">
                If you have questions about our use of cookies or this Cookie
                Policy, please contact our data protection team:
              </p>
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
                <div className="flex items-start gap-3">
                  <Icon
                    className="w-5 h-5 text-primary mt-0.5"
                    icon="solar:buildings-2-bold-duotone"
                  />
                  <span>
                    Pyro Labs Private Limited
                    <br />
                    Noida, Uttar Pradesh, India
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-divider">
                <p className="text-sm text-default-600">
                  For more information about how we handle your data, please see
                  our{" "}
                  <Link
                    className="text-primary hover:underline"
                    href="/privacy/policy"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
