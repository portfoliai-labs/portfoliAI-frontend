import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StepCardProps {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

const StepCard: React.FC<StepCardProps> = ({ number, icon: Icon, title, description, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className="flex flex-col items-center text-center gap-4 relative group"
    >
      <div className="absolute -top-10 -left-4 text-7xl font-black text-slate-800/50 -z-10">{number}</div>
      <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center border-[6px] border-slate-950 shadow-xl group-hover:border-cyan-900 transition-colors z-10">
        <Icon className="w-8 h-8 text-cyan-400" strokeWidth={2} />
      </div>
      <h3 className="text-xl font-bold text-white mt-4">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed max-w-[220px]">{description}</p>
    </motion.div>
  );
};

export default StepCard;