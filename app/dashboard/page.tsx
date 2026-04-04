"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UploadCloud } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Controllo di sicurezza lato client: esiste il token?
    const token = localStorage.getItem("auth_token");
    
    if (!token) {
      // Se non c'è il token, l'utente non è loggato. Lo rimandiamo alla home.
      router.push("/");
    } else {
      // Accesso consentito!
      setIsAuthorized(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    router.push("/");
  };

  // Mostra una schermata bianca (o un loader) finché non abbiamo verificato il token
  if (!isAuthorized) {
    return <div className="min-h-screen bg-slate-50"></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
        <div className="text-xl font-bold tracking-tighter text-blue-900">PortfoliAI Dashboard</div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-rose-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Benvenuto nella tua area riservata</h1>
        
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center border-dashed">
          <UploadCloud className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Carica il tuo file CSV</h2>
          <p className="text-slate-500 mb-6">Trascina qui il file esportato dal tuo broker per generare il report.</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Seleziona File
          </button>
        </div>
      </main>
    </div>
  );
}