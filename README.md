# Meyoo - Real-Time Profit Analytics for E-Commerce

> Transform your Shopify data into actionable profit insights by connecting sales with advertising costs from Meta and Google Ads.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2.18-pink.svg)](https://bun.sh/)
[![Convex](https://img.shields.io/badge/Convex-Real--time-orange.svg)](https://convex.dev/)

## 🚀 Overview

**Meyoo** is a comprehensive e-commerce analytics platform that helps Shopify store owners understand their true profitability by integrating sales data with advertising costs from Meta (Facebook) and Google Ads. Stop guessing your margins - see your real profit in real-time.

### ✨ Key Features

- **📊 Real-Time Profit Tracking** - See net profit after advertising costs instantly
- **🔗 Multi-Channel Integration** - Connect Shopify, Meta Ads, and Google Ads in one dashboard
- **💰 Product-Level Profitability** - Understand margin by SKU, not just overall revenue
- **📈 Historical Analytics** - Track trends and performance over time
- **⚡ Live Data Sync** - Automatic synchronization with all connected platforms
- **🎯 ROAS Calculation** - Accurate return on ad spend across all channels

## 🛠 Tech Stack

### Frontend

- **Next.js 15** - React framework with App Router and Turbopack
- **Tailwind CSS v4** - Utility-first CSS framework
- **HeroUI** - Modern React component library
- **Framer Motion** - Animation library
- **Recharts** - Data visualization
- **TypeScript** - Type-safe development

### Backend

- **Convex** - Real-time serverless database
- **Node.js** - JavaScript runtime
- **TypeScript** - Type-safe backend development
- **Workpool** - Background job processing
- **Rate Limiting** - API protection

### Integrations

- **Shopify Admin API** - E-commerce data
- **Meta Marketing API** - Facebook/Instagram advertising
- **Google Ads API** - Search advertising data

### Development

- **Bun** - Fast JavaScript runtime and package manager
- **Turborepo** - High-performance monorepo build system
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🏗 Architecture

This project uses a monorepo structure managed with Turborepo and Bun:

```
meyoo-better/
├── apps/
│   ├── web/                 # Customer-facing dashboard (Port 3000)
│   ├── meyoo/               # Admin backoffice app (Port 3001)
│   └── backend/             # Convex serverless backend
├── packages/
│   ├── @repo/types/         # Shared TypeScript types
│   ├── @repo/ui/            # Shared React components
│   ├── @repo/time/          # Time utility functions
│   ├── @repo/eslint-config/ # ESLint configuration
│   └── @repo/typescript-config/ # TypeScript configs
└── turbo.json              # Turborepo configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Bun package manager installed ([install guide](https://bun.sh/docs/installation))
- Convex account for backend deployment

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/meyoo-better.git
cd meyoo-better
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your configuration
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=your-convex-url
CONVEX_DEPLOY_KEY=your-deploy-key

# Shopify Integration
SHOPIFY_API_KEY=your-shopify-key
SHOPIFY_API_SECRET=your-shopify-secret
SHOPIFY_SCOPES=read_products,write_products,read_orders,write_orders
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Meta (Facebook) Integration
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_API_VERSION=v18.0

# Google Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_CLIENT_ID=your-google-ads-client-id
GOOGLE_ADS_CLIENT_SECRET=your-google-ads-client-secret

# Email Service (Resend)
RESEND_API_KEY=your-resend-api-key
AUTH_RESEND_KEY=your-auth-resend-key

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

### Development

Run all applications in development mode:

```bash
bun run dev
```

Or run specific applications:

```bash
# Customer dashboard
bun run dev --filter=web

# Admin dashboard
bun run dev --filter=meyoo

# Backend only
bun run dev --filter=backend
```

### Build

Build all applications for production:

```bash
bun run build
```

Build specific applications:

```bash
bun run build --filter=web
```

## 📝 Development Commands

### Code Quality

```bash
# Run ESLint with auto-fix
bun run lint

# TypeScript type checking
bun run check-types

# Watch mode for type checking
bun run watch-types

# Format code with Prettier
bun run format
```

### Convex Backend

```bash
# Deploy Convex backend
npx convex deploy

# Run Convex development server
npx convex dev

# View Convex dashboard
npx convex dashboard
```

## 📁 Project Structure

### Backend Organization (`/apps/backend/convex/`)

```
convex/
├── core/           # User management, organizations, billing
├── engine/         # Analytics, events, rate limiting, jobs
├── integrations/   # Shopify, Meta, Google adapters
├── jobs/           # Background tasks and processing
├── schema/         # Database table definitions
├── web/            # Customer-facing API endpoints
├── meyoo/          # Admin API endpoints
├── webhooks/       # Shopify and GDPR webhook handlers
├── sync/           # Data synchronization endpoints
├── http.ts         # HTTP route registration
└── crons.ts        # Scheduled job definitions
```

### Frontend Apps

- **`/apps/web`**: Customer dashboard for viewing profits and analytics
- **`/apps/meyoo`**: Internal admin dashboard for system management

### Shared Packages

- **`@repo/types`**: TypeScript types used across applications
- **`@repo/ui`**: Reusable React components
- **`@repo/time`**: Date/time utility functions
- **`@repo/eslint-config`**: Shared ESLint rules
- **`@repo/typescript-config`**: Shared TypeScript configurations

## 🔧 Configuration Files

- **`turbo.json`**: Turborepo pipeline configuration
- **`bun.lockb`**: Bun lock file for dependency management
- **`CLAUDE.md`**: AI assistant instructions for development
- **`rules_convex.md`**: Convex-specific development patterns

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

1. Always run `bun run lint` before committing
2. Ensure `bun run check-types` passes
3. Write clear commit messages
4. Update documentation for new features

## 📚 Documentation

- [Convex Documentation](https://docs.convex.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Shopify API Documentation](https://shopify.dev/docs/api)

## 🐛 Known Issues

- Rate limiting on initial data sync with large stores
- Meta API token refresh occasionally requires manual intervention
- Google Ads API has strict quota limits

## 📄 License

### Non-Compete Self-Host License

This software is made available under the following terms:

**✅ You CAN:**

- Use this software for personal use
- Self-host for your own business operations
- Modify the code for your own internal use
- Use as a learning resource or reference
- Deploy on your own infrastructure

**❌ You CANNOT:**

- Use this software to create a competing commercial service
- Resell, sublicense, or distribute as a SaaS product
- Offer this as a hosted service to third parties
- Create derivative works for commercial distribution
- Remove or modify this license notice

**Commercial Competition Clause:**
You may not use this software, in whole or in part, to build, operate, or offer any product or service that competes with Meyoo's commercial offerings. This includes but is not limited to e-commerce analytics platforms, profit tracking services, or multi-channel integration dashboards offered as a service to third parties.

For commercial licensing inquiries, please contact the Meyoo team.

© 2025 Meyoo. All rights reserved.

## 🙏 Acknowledgments

- Built with [Convex](https://convex.dev) for real-time backend
- UI components from [HeroUI](https://heroui.com)
- Monorepo powered by [Turborepo](https://turbo.build)
- Fast development with [Bun](https://bun.sh)

---

Built with ❤️ by the 0xHoney
