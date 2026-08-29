

export const SUBSCRIPTIONS = [
    {
      title: "Free",
      price: "€0",
      period: "forever",
      available: true,
      popular: false,
      ctaText: "Get Started",
      features: [
        "Daily portfolio dashboard",
        "Unlimited automatic periodic reports",
        "One full historical analysis",
        "Explicit + implicit cost tracking",
        "Guaranteed privacy"
      ]
    },
    {
      title: "Pro",
      price: "€49",
      period: "per year",
      altBilling: "or billed monthly at a premium",
      available: false,
      waitlist: true,
      popular: true,
      ctaText: "Get Notified",
      features: [
        "Unlimited full analyses",
        "Higher-precision implicit costs (intraday data)",
        "News digest for your holdings",
        "Annual tax summary",
        "Everything in Free"
      ]
    },
    {
      title: "Advisors",
      price: "Custom",
      period: "priced per client",
      available: false,
      waitlist: true,
      popular: false,
      ctaText: "Get Notified",
      features: [
        "White-label reports",
        "Bulk report generation",
        "Automatic periodic reports for every client",
        "Everything in Pro"
      ]
    }
  ];
