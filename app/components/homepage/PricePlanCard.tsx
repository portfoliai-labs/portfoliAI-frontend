import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricePlanCardProps {
  title: string;
  price: string;
  features: string[];
  ctaText: string;
  popular: boolean;
  index: number;
  login: () => void;
}

const PricePlanCard: React.FC<PricePlanCardProps> = ({ title, price, features, ctaText, popular, index, login }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      whileInView={{ opacity: 1, scale: popular ? 1.05 : 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className={`bg-slate-900 p-10 rounded-3xl border ${popular ? 'border-cyan-500 shadow-[0_0_40px_-15px_rgba(6,182,212,0.4)]' : 'border-slate-800'} flex flex-col gap-8 relative`}
    >
      {popular && (
          <div className="absolute top-0 right-10 -translate-y-1/2 bg-cyan-500 text-slate-950 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
              Most Popular
          </div>
      )}
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <div className="flex items-baseline gap-1 mb-2">
          <p className="text-5xl font-extrabold text-white">
            {price}
          </p>
          {price !== 'Free' && <span className="text-slate-500">/month</span>}
        </div>
      </div>
      <ul className="space-y-4 flex-grow">
        {features.map(feature => (
          <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
            <div className="w-5 h-5 rounded-full bg-cyan-900/50 flex items-center justify-center shrink-0">
               <Check className="w-3 h-3 text-cyan-400" />
            </div>
            {feature}
          </li>
        ))}
      </ul>
      <button 
        onClick={login}
        className={`w-full py-3.5 rounded-xl font-bold transition-all ${popular ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
      >
        {ctaText}
      </button>
    </motion.div>
  );
};

export default PricePlanCard;