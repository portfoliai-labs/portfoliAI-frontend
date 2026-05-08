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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group flex flex-col gap-5 p-8 border border-stone-200 rounded-[4px] bg-white hover:bg-stone-50 transition-colors duration-200"
    >
      <div
        className="w-9 h-9 flex items-center justify-center border border-stone-200 rounded-[4px] group-hover:border-[rgba(196,154,60,0.4)] transition-colors"
      >
        <Icon
          className="w-4 h-4 transition-colors"
          style={{ color: '#8A6A28' }}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className="text-[17px] font-bold text-stone-900 leading-tight tracking-tight"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {title}
      </h3>
      <p className="text-[13px] text-stone-500 leading-relaxed">{description}</p>
    </motion.div>
  );
};

export default FeatureCard;
