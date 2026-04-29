import { motion } from 'framer-motion';
import PricePlanCard from '../common/PricePlanCard';
import {SUBSCRIPTIONS} from '../../constants/subscriptions'

const SubscriptionSection = () => {

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
           {SUBSCRIPTIONS.map((plan, index) => (
             <PricePlanCard 
               key={index} 
               index={index} 
               {...plan} 
             />
           ))}
        </div>
      </div>
    </section>
  );
};

export default SubscriptionSection;