import Link from 'next/link';
import { Heart, User, Settings, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex-1 bg-cream-100 flex flex-col justify-between">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">CareLoop</span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/agents" 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cream-300 text-xs font-semibold text-slate-600 hover:bg-cream-200 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Agent Monitor
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-6 border border-emerald-100">
            <Activity className="h-3 w-3" />
            Hackathon MVP Build
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-800 sm:text-6xl mb-6">
            Making invisible care work <span className="text-emerald-600">visible</span>.
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            AI care coordination for families supporting elderly loved ones who live alone.
          </p>
        </div>

        {/* Story Card */}
        <div className="bg-white rounded-2xl border border-cream-300 shadow-sm p-8 mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-50 rounded-full blur-3xl -z-10 translate-x-12 -translate-y-12"></div>
          <div className="max-w-2xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">The CareLoop Story</h2>
            <p className="text-xl font-medium text-slate-800 leading-relaxed mb-4">
              “Aino is 80 and lives alone. Her daughter Saara works full-time and cannot manually check every care detail every day. CareLoop helps them coordinate tasks, reminders, daily wellbeing context, and safe escalation.”
            </p>
            <div className="flex gap-4 text-xs font-semibold text-slate-500">
              <span>👵 Aino (Elderly Loved One)</span>
              <span>•</span>
              <span>👩 Saara (Family Caregiver)</span>
            </div>
          </div>
        </div>

        {/* Dashboard Switcher Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Card 1: Aino View */}
          <Link href="/aino" className="group">
            <div className="h-full bg-white rounded-2xl border border-cream-300 p-8 shadow-sm hover-card flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-100 transition-colors">
                  <User className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">View as Aino</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Elderly-person view. Extremely simple interface with large readable text, big buttons for daily checklist confirmation, and urgent help requests.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                Open Dashboard <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Card 2: Saara View */}
          <Link href="/saara" className="group">
            <div className="h-full bg-white rounded-2xl border border-cream-300 p-8 shadow-sm hover-card flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-100 transition-colors">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">View as Saara</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  Caregiver portal. Displays current care concern levels, morning state brief, task tracker, alert logs, and a step-by-step audit timeline of the agent activities.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                Open Dashboard <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>

        {/* Responsible AI section */}
        <div className="bg-cream-100 rounded-2xl border border-cream-300 p-8">
          <div className="flex items-center gap-2.5 mb-6 text-slate-800">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold">CareLoop Safety &amp; Principles</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm text-slate-600">
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>No medical diagnosis</strong>: CareLoop does not diagnose health issues or provide medical advice.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Not emergency dispatch</strong>: CareLoop does not replace doctors, nurses, or emergency services.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Human-in-the-loop</strong>: Family caregivers remain in control and oversee all decisions.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Explainable reasoning</strong>: The system details exactly why alarms or reminder calls occur.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Authorized reminders</strong>: Calls only trigger for tasks created or approved by the caregiver.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Passive wearable data</strong>: Tracker data serves as daily context, never medical proof.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <p><strong>Safe escalation</strong>: Escalation triggers gently, checking task status and call replies first.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-cream-300 py-8 text-center text-xs text-slate-500">
        <p>© 2026 CareLoop. Hackathon Prototype.</p>
      </footer>
    </div>
  );
}
