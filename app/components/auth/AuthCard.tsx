"use client";

import { Zap, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react';
import { useAuthFlow } from '../../hooks/useAuthFlow';

export function AuthCard() {
  const { login, status, isError, generatedKey, copied, handleCopy } = useAuthFlow();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white">
      <div className="p-10 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-2xl text-center space-y-8 max-w-sm w-full mx-4">
        
        <div className="flex justify-center">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
            <Zap className="text-white h-8 w-8" />
          </div>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-blue-950">PortfoliAI Auth</h1>
          <p className={`mt-2 text-sm font-medium ${isError ? 'text-rose-600' : 'text-slate-500'}`}>
            {status}
          </p>
        </div>
        
        {!generatedKey ? (
          <button 
            onClick={() => login()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 group"
          >
            Proceed with Google
            <ShieldCheck className="h-5 w-5 opacity-70 group-hover:opacity-100" />
          </button>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group break-all">
              <code className="text-sm font-bold text-slate-800">
                {generatedKey}
              </code>
            </div>
            
            <button 
              onClick={handleCopy}
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2
                ${copied ? 'bg-green-100 text-green-700 shadow-inner' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg'}`}
            >
              {copied ? (
                <><CheckCircle2 className="h-5 w-5" /> Copied to Clipboard!</>
              ) : (
                <><Copy className="h-5 w-5" /> Copy Access Key</>
              )}
            </button>
            <p className="text-xs text-slate-500">
              You can now safely close this window and paste the key in Wealthfolio.
            </p>
          </div>
        )}

        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
          Secure ephemeral session
        </p>
      </div>
    </div>
  );
}