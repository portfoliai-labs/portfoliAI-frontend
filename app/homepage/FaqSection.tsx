

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer, isOpen, onToggle, index }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`bg-slate-900/50 border rounded-2xl overflow-hidden transition-colors ${
        isOpen ? 'border-cyan-500/50' : 'border-slate-800'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between gap-4 text-left transition-all"
      >
        <span className="text-lg font-semibold text-white">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 text-slate-400 leading-relaxed border-t border-slate-800/50 pt-4 mt-1">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqData = [
    {
      question: "What is the difference between standard and SOTA models?",
      answer: "Standard models provide reliable analysis using efficient AI, while SOTA (State of the Art) models use the most advanced neural networks available. SOTA models offer deeper reasoning, better context understanding, and more nuanced financial insights."
    },
    {
      question: "Is my financial data secure?",
      answer: "Absolutely. We prioritize privacy and data security. We do not store your sensitive financial credentials, and all analysis is performed following strict encryption protocols."
    },
    {
      question: "When will the Pro and Enterprise plans be available?",
      answer: "We are currently fine-tuning our advanced analysis engines. These plans are marked as 'Coming Soon' and will be launched in the next few months. Stay tuned for early access announcements!"
    },
    {
        question: "Is my financial data secure?",
        answer: "Absolutely. We do not store your transaction data. The file is processed in RAM and discarded as soon as the report is generated.",
    },
    {
        question: "Which brokers are supported?",
        answer: "We support CSV/Excel formats from most major brokers (e.g., Degiro, Interactive Brokers, Fineco). The AI automatically adapts to column formats."
    }
  ];

  return (
    <section id="faq" className="py-32 bg-slate-950 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-6">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-5xl font-bold text-white mb-16 text-center"
        >
          Frequently Asked Questions
        </motion.h1>
        
        {/* Container con spazio tra le cards */}
        <div className="flex flex-col gap-4">
          {faqData.map((faq, index) => (
            <FaqItem 
              key={index} 
              index={index}
              question={faq.question} 
              answer={faq.answer} 
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;