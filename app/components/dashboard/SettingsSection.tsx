"use client";

import { useState } from "react";

export function SettingsSection() {
  const [settings, setSettings] = useState({
    language: "it",
    goal: "",
    riskTolerance: "medium"
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Impostazioni Profilo</h2>
      
      <div className="grid gap-4 bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <label className="block text-sm font-semibold mb-2">Lingua Report</label>
          <select 
            className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
            value={settings.language}
            onChange={(e) => setSettings({...settings, language: e.target.value})}
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Obiettivo Finanziario</label>
          <textarea 
            className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
            placeholder="Es: Pensione integrativa, acquisto casa..."
            value={settings.goal}
            onChange={(e) => setSettings({...settings, goal: e.target.value})}
          />
        </div>

        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all">
          Salva Preferenze
        </button>
      </div>
    </div>
  );
}