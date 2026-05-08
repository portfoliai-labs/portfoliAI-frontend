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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="relative flex flex-col px-10 py-10"
    >
      {/* Background step number */}
      <span
        className="absolute top-6 right-8 text-[56px] font-black leading-none select-none pointer-events-none"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          color: 'rgba(255,255,255,0.04)',
        }}
      >
        0{number}
      </span>

      {/* Icon box */}
      <div
        className="w-11 h-11 flex items-center justify-center rounded-[4px] border mb-6 flex-shrink-0"
        style={{ borderColor: 'rgba(196,154,60,0.25)' }}
      >
        <Icon className="w-5 h-5" style={{ color: '#E8C97A' }} strokeWidth={1.5} />
      </div>

      <h3
        className="text-[20px] font-bold mb-3 tracking-tight"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          color: '#fff',
        }}
      >
        {title}
      </h3>
      <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {description}
      </p>
    </motion.div>
  );
};

export default StepCard;
