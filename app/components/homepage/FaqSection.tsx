// app/homepage/FaqSection.tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * Interface for single FAQ data
 */
interface FaqData {
  question: string;
  answer: string;
}

/**
 * Sub-component for individual FAQ items to keep the main component clean
 */
const FaqItem = ({ 
  faq, 
  isOpen, 
  onToggle, 
  index 
}: { 
  faq: FaqData; 
  isOpen: boolean; 
  onToggle: () => void; 
  index: number;
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`bg-slate-900/50 border rounded-2xl overflow-hidden transition-all duration-300 ${
        isOpen ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-slate-800'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between gap-4 text-left"
      >
        <span className="text-lg font-bold text-white">{faq.question}</span>
        <ChevronDown 
          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 text-slate-400 leading-relaxed">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqData: FaqData[] = [
    {
      question: "How does the AI analysis work?",
      answer: "Our engine uses advanced LLMs to parse your PDF statements, identifying every single transaction, commission, and hidden spread without storing any personal data."
    },
    {
      question: "Is my financial data secure?",
      answer: "Absolutely. We follow a 'Zero-Retention' policy. Your files are processed in RAM and destroyed immediately after the report generation."
    },
    {
      question: "Which brokers are supported?",
      answer: "We support major brokers like Interactive Brokers, DeGiro, Fineco, and many others. If your broker is not listed, our generic parser usually handles standard CSV/PDF exports."
    }
  ];

  return (
    <section id="faq" className="py-32 bg-slate-950 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Common Questions
          </h2>
          <p className="text-slate-400 font-medium">
            Everything you need to know about PortfoliAI.
          </p>
        </div>
        
        <div className="flex flex-col gap-4">
          {faqData.map((faq, index) => (
            <FaqItem 
              key={index}
              index={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}