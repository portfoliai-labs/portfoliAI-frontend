import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-slate-800/40 p-8 rounded-3xl border border-slate-700 flex flex-col gap-5 hover:bg-slate-800 transition-colors group"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-700 group-hover:border-cyan-500/50 transition-colors">
        <Icon className="w-6 h-6 text-cyan-400" strokeWidth={2} />
      </div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
  );
};

export default FeatureCard;