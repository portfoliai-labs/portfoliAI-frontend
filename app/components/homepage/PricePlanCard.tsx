import { Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricePlanCardProps {
  title: string;
  price: string;
  features: string[];
  ctaText: string;
  popular: boolean;
  index: number;
  available: boolean; // Nuova prop per gestire la disponibilità
  login: () => void;
}

const PricePlanCard: React.FC<PricePlanCardProps> = ({ 
  title, 
  price, 
  features, 
  ctaText, 
  popular, 
  index, 
  available, 
  login 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 30 }}
      whileInView={{ 
        opacity: available ? 1 : 0.6, 
        scale: (popular && available) ? 1.05 : 1, 
        y: 0 
      }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className={`bg-slate-900 p-10 rounded-3xl border transition-all ${
        popular && available 
          ? 'border-cyan-500 shadow-[0_0_40px_-15px_rgba(6,182,212,0.4)]' 
          : 'border-slate-800'
      } flex flex-col gap-8 relative ${!available && 'grayscale-[0.5]'}`}
    >
      {popular && available && (
          <div className="absolute top-0 right-10 -translate-y-1/2 bg-cyan-500 text-slate-950 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
              Most Popular
          </div>
      )}
      
      {!available && (
          <div className="absolute top-0 right-10 -translate-y-1/2 bg-slate-700 text-slate-300 px-4 py-1 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Lock className="w-3 h-3" /> Soon Available
          </div>
      )}

      <div>
        <h3 className={`text-2xl font-bold mb-2 ${available ? 'text-white' : 'text-slate-400'}`}>{title}</h3>
        <div className="flex items-baseline gap-1 mb-2">
          <p className={`text-5xl font-extrabold ${available ? 'text-white' : 'text-slate-500'}`}>
            {price}
          </p>
          {price !== 'Free' && price !== 'TBD' && (
            <span className="text-slate-500">/month</span>
          )}
        </div>
      </div>

      <ul className="space-y-4 flex-grow">
        {features.map(feature => (
          <li key={feature} className={`flex items-center gap-3 text-sm ${available ? 'text-slate-300' : 'text-slate-500'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${available ? 'bg-cyan-900/50' : 'bg-slate-800'}`}>
               <Check className={`w-3 h-3 ${available ? 'text-cyan-400' : 'text-slate-600'}`} />
            </div>
            {feature}
          </li>
        ))}
      </ul>

      <button 
        onClick={available ? login : undefined}
        disabled={!available}
        className={`w-full py-3.5 rounded-xl font-bold transition-all ${
          !available 
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
            : popular 
              ? 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-900/20' 
              : 'bg-slate-800 text-white hover:bg-slate-700'
        }`}
      >
        {available ? ctaText : 'Coming Soon'}
      </button>
    </motion.div>
  );
};

export default PricePlanCard;