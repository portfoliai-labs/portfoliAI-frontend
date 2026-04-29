import { motion } from 'framer-motion';
import PricePlanCard from '../components/homepage/PricePlanCard';

const PricingSection = () => {
  // We define the data here following your requirements
  const pricingData = [
    {
      title: "Free",
      price: "Free",
      available: true,
      popular: false,
      ctaText: "Get Started",
      features: [
        "1 monthly report for free",
        "Guaranteed privacy",
        "Standard AI analysis model",
        "Prices & metadata via Yahoo Finance",
        "Automatic currency conversion"
      ]
    },
    {
      title: "Pro",
      price: "$19", // Placeholder price
      available: false, // Set to false as requested
      popular: true,
      ctaText: "Upgrade to Pro",
      features: [
        "Up to 10 monthly SOTA reports",
        "Early access to new analysis types",
        "Multiple accurate data sources",
        "Automatic currency conversion"
      ]
    },
    {
      title: "Enterprise",
      price: "Custom",
      available: false, // Set to false as requested
      popular: false,
      ctaText: "Contact Sales",
      features: [
        "All Pro features included",
        "Customized reporting options",
        "Dedicated support",
      ]
    }
  ];

  const login = () => {
    // Replace with your actual login/auth logic
    console.log("Redirecting to login...");
  };

  return (
    <section id="pricing" className="py-32 bg-slate-950 border-t border-b border-slate-800 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.h2 
             initial={{ opacity: 0, y: 20 }} 
             whileInView={{ opacity: 1, y: 0 }} 
             viewport={{ once: true, margin: "-100px" }}
             className="text-3xl md:text-5xl font-bold text-white mb-4"
          >
            Simple, transparent pricing
          </motion.h2>
          <p className="text-slate-400 text-lg">
            Choose the plan that best fits your analysis needs.
          </p>
        </div>

        {/* Changed grid-cols-1 md:grid-cols-2 to md:grid-cols-3 
            to accommodate the three plans side-by-side on desktop.
        */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
           {pricingData.map((plan, index) => (
             <PricePlanCard 
               key={index} 
               index={index} 
               {...plan} 
               login={login} 
             />
           ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;