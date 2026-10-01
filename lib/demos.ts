export type Demo = {
  slug: string;
  name: string;
  tagline: string;
  industry: string;
  stack: string[];
  features: string[];
  accent: string; // tailwind-free hex, used for card accents
};

export const demos: Demo[] = [
  {
    slug: "cafe-qr-order",
    name: "Brew & Bean",
    tagline: "QR table ordering and kitchen display for a café",
    industry: "Café / Restaurant",
    stack: ["Next.js", "TypeScript", "Supabase Realtime", "Stripe PromptPay", "Tailwind CSS"],
    features: ["QR menu per table", "Live kitchen order board", "PromptPay QR checkout", "Admin menu management"],
    accent: "#b45309",
  },
  {
    slug: "salon-booking",
    name: "Studio Lumi",
    tagline: "Online appointment booking for a salon or clinic",
    industry: "Salon / Clinic",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase Auth", "Resend", "Tailwind CSS"],
    features: ["Slot availability by staff", "Booking confirmation emails", "Staff calendar", "Deposit payment"],
    accent: "#be185d",
  },
  {
    slug: "handmade-shop",
    name: "Baan Craft",
    tagline: "E-commerce storefront for a small handmade brand",
    industry: "Online Store",
    stack: ["Next.js", "TypeScript", "Stripe Checkout", "Supabase Storage", "Webhooks", "Tailwind CSS"],
    features: ["Product catalog & variants", "Cart and checkout", "Webhook-driven order status", "Inventory tracking"],
    accent: "#15803d",
  },
  {
    slug: "gym-membership",
    name: "IronPulse Fitness",
    tagline: "Memberships, class schedule and recurring billing for a gym",
    industry: "Gym / Studio",
    stack: ["Next.js", "TypeScript", "Stripe Subscriptions", "Supabase Auth + RLS", "Tailwind CSS"],
    features: ["Plans & subscriptions", "Class booking with capacity", "Member portal", "Entitlement by plan"],
    accent: "#dc2626",
  },
  {
    slug: "invoice-dashboard",
    name: "BizLedger",
    tagline: "Invoicing, inventory and sales dashboard for SMEs",
    industry: "Back-office SaaS",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Role-based access", "Recharts", "Tailwind CSS"],
    features: ["Invoice builder & PDF view", "Stock levels & alerts", "Sales charts", "Owner / staff roles"],
    accent: "#2563eb",
  },
  {
    slug: "rental-listings",
    name: "Nest Rentals",
    tagline: "Property and apartment listing site with inquiry management",
    industry: "Real Estate",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Supabase Storage", "Server Actions", "Tailwind CSS"],
    features: ["Search & filters", "Listing detail gallery", "Inquiry form to admin inbox", "Agent dashboard"],
    accent: "#7c3aed",
  },
];

export const getDemo = (slug: string) => demos.find((d) => d.slug === slug)!;
