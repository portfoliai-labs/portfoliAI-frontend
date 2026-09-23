"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Loader2, X, Check, Users, ChevronRight, Info, AlertTriangle, BellRing } from "lucide-react";
import { advisorService } from "../../services/advisorService";
import { useClientAlertRules } from "../../hooks/useAlertRules";
import { alertState } from "../../lib/alerts";
import { AlertsSettings } from "./AlertsSettings";
import { TONE_STYLES } from "./AlertGauge";
import { UserRole } from "../../models/Advisor";
import type { Client, ClientCreatePayload, ClientProfileUpdatePayload } from "../../models/Advisor";
import type { AlertRuleResponse } from "../../models/Alert";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The Dashboard's client alerts open a client's panel here through the URL hash (#client=<uuid>),
// read when this section mounts.
export const CLIENT_HASH_PREFIX = "#client=";

export function clientDisplayName(client: Client) {
  return client.first_name || client.last_name
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : client.email;
}

function initials(client: Client) {
  const f = client.first_name?.[0] ?? "";
  const l = client.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || client.email[0].toUpperCase();
}

function ClientAvatar({ client, size = "md" }: { client: Client; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-9 h-9 text-xs", md: "w-12 h-12 text-sm", lg: "w-16 h-16 text-lg" };
  return (
    <div className={`${sizes[size]} rounded-2xl bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] shrink-0`}>
      {initials(client)}
    </div>
  );
}

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF"];
const LANGUAGE_OPTIONS = [
  { value: "it", label: "Italian" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

interface AddClientForm {
  email: string;
  first_name: string;
  last_name: string;
  language: string;
  currency: string;
}

const emptyForm: AddClientForm = {
  email: "",
  first_name: "",
  last_name: "",
  language: "it",
  currency: "EUR",
};

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#78716c] uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] text-[#1c1917] text-sm font-medium placeholder:text-[#a8a29e] focus:outline-none focus:border-[#C49A3C] focus:ring-2 focus:ring-[#C49A3C]/10 transition-all"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#78716c] uppercase tracking-wider mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] text-[#1c1917] text-sm font-medium focus:outline-none focus:border-[#C49A3C] focus:ring-2 focus:ring-[#C49A3C]/10 transition-all"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

type LookupStatus = "idle" | "checking" | "new" | "existing_client" | "existing_other";

function AddClientDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const [form, setForm] = useState<AddClientForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState<{
    status: LookupStatus;
    firstName?: string | null;
    lastName?: string | null;
  }>({ status: "idle" });
  const lookupRequestId = useRef(0);

  const set = (field: keyof AddClientForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  useEffect(() => {
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) {
      setLookup({ status: "idle" });
      return;
    }

    const requestId = ++lookupRequestId.current;
    setLookup({ status: "checking" });

    const timer = setTimeout(async () => {
      try {
        const result = await advisorService.lookupClient(email);
        if (lookupRequestId.current !== requestId) return;

        if (!result.exists) {
          setLookup({ status: "new" });
          return;
        }

        if (result.role === UserRole.USER) {
          setLookup({ status: "existing_client", firstName: result.first_name, lastName: result.last_name });
          setForm((prev) => ({
            ...prev,
            first_name: result.first_name ?? prev.first_name,
            last_name: result.last_name ?? prev.last_name,
          }));
        } else {
          setLookup({ status: "existing_other" });
        }
      } catch {
        if (lookupRequestId.current === requestId) setLookup({ status: "idle" });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.email]);

  const isValid =
    lookup.status === "existing_other"
      ? false
      : lookup.status === "existing_client"
      ? Boolean(form.email.trim())
      : Boolean(form.email.trim() && form.first_name.trim() && form.last_name.trim());

  const showInheritedFields = lookup.status !== "existing_client" && lookup.status !== "existing_other";

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      // Existing users may have no name on record; the backend ignores these
      // fields for them anyway, but the payload still requires non-empty values.
      const payload: ClientCreatePayload = {
        email: form.email.trim(),
        first_name: form.first_name.trim() || "Client",
        last_name: form.last_name.trim() || "-",
        language: form.language,
        currency: form.currency || undefined,
      };
      const created = await advisorService.createClient(payload);
      onCreated(created);
    } catch {
      setError("Unable to create client. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Portaled to <body> above the dashboard's sticky header (z-60), like the app's other modals.
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl border border-[rgba(196,154,60,0.2)] p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            New Client
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F7F5EF] text-[#78716c] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <InputField label="Email" value={form.email} onChange={set("email")} type="email" required />
            {lookup.status === "checking" && (
              <Loader2 className="w-4 h-4 animate-spin text-[#C49A3C] absolute right-3 top-9" />
            )}
          </div>

          {lookup.status === "existing_client" && (
            <div className="flex items-start gap-2.5 rounded-xl bg-[#F7F5EF] border border-[rgba(196,154,60,0.3)] px-4 py-3">
              <Info className="w-4 h-4 text-[#C49A3C] shrink-0 mt-0.5" />
              <p className="text-sm text-[#1c1917] font-medium">
                {(lookup.firstName || lookup.lastName)
                  ? `${lookup.firstName ?? ""} ${lookup.lastName ?? ""}`.trim()
                  : "This user"} is already registered on the platform. Their existing profile will be linked — no need to re-enter their details.
              </p>
            </div>
          )}

          {lookup.status === "existing_other" && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600 font-medium">
                This email is already associated with another account and can&apos;t be added as a client.
              </p>
            </div>
          )}

          {showInheritedFields && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#C49A3C]">Personal Details</p>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="First name" value={form.first_name} onChange={set("first_name")} required />
                <InputField label="Last name" value={form.last_name} onChange={set("last_name")} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Language"
                  value={form.language}
                  onChange={set("language")}
                  options={LANGUAGE_OPTIONS}
                />
                <SelectField
                  label="Portfolio currency"
                  value={form.currency}
                  onChange={set("currency")}
                  options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
                />
              </div>
            </>
          )}

          {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[rgba(196,154,60,0.3)] text-[#78716c] font-bold text-sm hover:bg-[#F7F5EF] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 py-3 rounded-xl bg-[#1c1917] text-white font-bold text-sm hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {lookup.status === "existing_client" ? "Link Client" : "Add Client"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * CLIENT PANEL — one client: the alerts the advisor set on their portfolio, and below them the
 * client's language and portfolio currency. Changing the currency makes the backend recompute
 * the client's whole portfolio history in the new currency.
 */
function ClientPanel({
  client,
  onClose,
  onUpdated,
}: {
  client: Client;
  onClose: () => void;
  onUpdated: (client: Client) => void;
}) {
  const [form, setForm] = useState({
    currency: client.currency ?? "EUR",
    language: client.language ?? "it",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const name = clientDisplayName(client);
  const dirty = form.currency !== (client.currency ?? "EUR") || form.language !== (client.language ?? "it");

  const set = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: ClientProfileUpdatePayload = {
        currency: form.currency || null,
        language: form.language || null,
      };
      await advisorService.updateClientProfile(client.uuid, payload);
      onUpdated({
        ...client,
        currency: payload.currency ?? client.currency,
        language: payload.language ?? client.language,
      });
      setMessage({ type: "success", text: "Client settings saved." });
    } catch {
      setMessage({ type: "error", text: "Unable to save the client settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Portaled to <body> above the dashboard's sticky header (z-60), like the app's other modals.
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl bg-[#F7F5EF] rounded-[2rem] shadow-2xl border border-[rgba(196,154,60,0.2)] p-5 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ClientAvatar client={client} size="sm" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#1c1917] truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {name}
              </h2>
              <p className="text-xs text-[#78716c] truncate">{client.email}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl hover:bg-white text-[#78716c] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <AlertsSettings clientUuid={client.uuid} clientName={name} />

        <div className="bg-white p-6 rounded-[2rem] border border-[rgba(196,154,60,0.2)] space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C49A3C]">Client settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="Language" value={form.language} onChange={set("language")} options={LANGUAGE_OPTIONS} />
            <SelectField
              label="Portfolio currency"
              value={form.currency}
              onChange={set("currency")}
              options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
          </div>
          {message && (
            <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-600" : "text-rose-500"}`}>
              {message.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1c1917] text-white font-bold text-xs hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** "3 alerts · 1 triggered", or null with no alerts; the tone follows the most pressing one. */
function alertsSummary(rules: AlertRuleResponse[]) {
  if (rules.length === 0) return null;
  const states = rules.map(alertState);
  const triggered = states.filter((st) => st.tone === "danger").length;
  const approaching = states.filter((st) => st.tone === "warn").length;
  const count = `${rules.length} ${rules.length === 1 ? "alert" : "alerts"}`;
  if (triggered > 0) return { text: `${count} · ${triggered} triggered`, tone: "danger" as const };
  if (approaching > 0) return { text: `${count} · ${approaching} approaching`, tone: "warn" as const };
  return { text: count, tone: "ok" as const };
}

function ClientCard({
  client,
  rules,
  onOpen,
  onDelete,
}: {
  client: Client;
  rules: AlertRuleResponse[] | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const summary = rules ? alertsSummary(rules) : null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await advisorService.deleteClient(client.uuid);
      onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Only the card itself: Enter on the delete button inside it mustn't open the panel.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      className="bg-white rounded-[1.5rem] border border-[rgba(196,154,60,0.2)] p-5 hover:border-[#C49A3C]/40 hover:shadow-sm transition-all group cursor-pointer text-left"
    >
      <div className="flex items-start gap-4">
        <ClientAvatar client={client} />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#1c1917] text-sm truncate">
            {client.first_name || client.last_name
              ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
              : "—"}
          </h3>
          <p className="text-xs text-[#78716c] truncate">{client.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {client.currency && (
              <span className="px-2 py-0.5 rounded-lg bg-[#F7F5EF] text-[10px] font-bold text-[#78716c] uppercase tracking-wider">
                {client.currency}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`p-2 rounded-xl transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 ${
            confirmDelete
              ? "bg-rose-50 text-rose-500 hover:bg-rose-100 sm:opacity-100"
              : "hover:bg-[#F7F5EF] text-[#78716c] hover:text-rose-400"
          }`}
          title={confirmDelete ? "Click again to confirm" : "Delete client"}
          aria-label={confirmDelete ? "Click again to confirm" : "Delete client"}
          onBlur={() => setConfirmDelete(false)}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
      <div className="mt-4 pt-3 border-t border-[rgba(196,154,60,0.1)] flex items-center justify-between gap-2">
        {summary ? (
          <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[summary.tone].chip}`}>
            <BellRing className="w-3 h-3" /> {summary.text}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#a8a29e]">
            <BellRing className="w-3 h-3" /> {rules === null ? "Loading alerts…" : "No alerts"}
          </span>
        )}
        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#C49A3C]">
          Manage <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
}

export function ClientsSection() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [openClient, setOpenClient] = useState<Client | null>(null);
  const { rules: clientRules, reload: reloadRules } = useClientAlertRules();

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await advisorService.getClients();
      setClients(data);
      // Arriving from the Dashboard's client alerts: open that client, then drop the hash so
      // coming back to this section later doesn't reopen it.
      if (window.location.hash.startsWith(CLIENT_HASH_PREFIX)) {
        const uuid = decodeURIComponent(window.location.hash.slice(CLIENT_HASH_PREFIX.length));
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        setOpenClient(data.find((c) => c.uuid === uuid) ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const rulesFor = (uuid: string) =>
    clientRules === null ? null : clientRules.filter((r) => r.clientUuid === uuid);
  const triggeredCount = (clientRules ?? []).filter((r) => alertState(r).tone === "danger").length;

  const handleCreated = (client: Client) => {
    setClients((prev) => [client, ...prev]);
    setShowAdd(false);
  };

  const handleUpdated = (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.uuid === updated.uuid ? updated : c)));
    setOpenClient(updated);
  };

  const handleDeleted = (uuid: string) => {
    setClients((prev) => prev.filter((c) => c.uuid !== uuid));
    reloadRules();
  };

  // The panel changes that client's rules directly; refresh the cards' summaries once it closes.
  const handleClosePanel = () => {
    setOpenClient(null);
    reloadRules();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-1">Client Management</p>
          <h1 className="text-3xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Your Clients
          </h1>
          <p className="text-sm text-[#78716c] mt-1">Open a client to set alerts on their portfolio.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1c1917] text-white rounded-xl font-bold text-sm hover:bg-[#C49A3C] transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Stats row */}
      {!loading && clients.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div className="bg-white rounded-2xl border border-[rgba(196,154,60,0.2)] px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C49A3C]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#C49A3C]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1c1917]">{clients.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Total clients</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[rgba(196,154,60,0.2)] px-5 py-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${triggeredCount > 0 ? "bg-rose-50" : "bg-[#C49A3C]/10"}`}>
              <BellRing className={`w-4 h-4 ${triggeredCount > 0 ? "text-rose-500" : "text-[#C49A3C]"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1c1917]">{clientRules === null ? "—" : clientRules.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716c]">
                Alerts{triggeredCount > 0 ? ` · ${triggeredCount} triggered` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-[#C49A3C]" />
          </div>
          <h3 className="text-lg font-bold text-[#1c1917] mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            No clients yet
          </h3>
          <p className="text-sm text-[#78716c] mb-6">Add your first client to get started.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#1c1917] text-white rounded-xl font-bold text-sm hover:bg-[#C49A3C] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.uuid}
              client={client}
              rules={rulesFor(client.uuid)}
              onOpen={() => setOpenClient(client)}
              onDelete={() => handleDeleted(client.uuid)}
            />
          ))}
          {/* Add new card */}
          <button
            onClick={() => setShowAdd(true)}
            className="bg-white rounded-[1.5rem] border-2 border-dashed border-[rgba(196,154,60,0.3)] p-5 hover:border-[#C49A3C]/60 hover:bg-[#F7F5EF]/50 transition-all flex flex-col items-center justify-center gap-2 text-[#a8a29e] hover:text-[#C49A3C] min-h-[120px]"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-bold uppercase tracking-wider">New Client</span>
          </button>
        </div>
      )}

      {showAdd && <AddClientDrawer onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
      {openClient && (
        <ClientPanel
          key={openClient.uuid}
          client={openClient}
          onClose={handleClosePanel}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
