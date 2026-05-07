import { User } from "lucide-react";

interface StepPersonalProps {
  formData: any;
  setFormData: (data: any) => void;
}

export function StepPersonal({ formData, setFormData }: StepPersonalProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">Welcome! What's your name?</h1>
        <p className="text-slate-500 mt-2">Let's get to know you to personalize your experience.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">First Name</label>
          <input 
            type="text" 
            autoFocus
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
            value={formData.first_name}
            onChange={(e) => setFormData({...formData, first_name: e.target.value})}
            placeholder="E.g. John"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Last Name</label>
          <input 
            type="text" 
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
            value={formData.last_name}
            onChange={(e) => setFormData({...formData, last_name: e.target.value})}
            placeholder="E.g. Doe"
          />
        </div>
      </div>
    </div>
  );
}