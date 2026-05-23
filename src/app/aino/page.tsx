'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, AlertCircle, ArrowLeft, Heart, RefreshCw, HelpCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  category: string;
  due_time: string;
  priority: string;
  status: string;
  description: string;
}

export default function AinoDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/aino/tasks');
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleComplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
      const data = await res.json();
      if (data.ok) {
        setMessage({ text: 'Task completed! Good job, Aino! ❤️', type: 'success' });
        fetchTasks();
      } else {
        setMessage({ text: 'Error: ' + data.error, type: 'error' });
      }
    } catch {
      setMessage({ text: 'Failed to update task.', type: 'error' });
    }
  };

  const handleNeedHelp = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/need-help`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMessage({ text: 'We have notified Saara. She will contact you soon.', type: 'success' });
        fetchTasks();
      } else {
        setMessage({ text: 'Error: ' + data.error, type: 'error' });
      }
    } catch {
      setMessage({ text: 'Failed to send alert.', type: 'error' });
    }
  };

  return (
    <div className="flex-1 bg-[#fbfaf7] flex flex-col">
      {/* Elderly Friendly Header */}
      <header className="bg-white border-b border-cream-300 py-6 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-600 font-semibold text-lg hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-extrabold text-slate-800">Aino’s Checklist</span>
            <span className="text-2xl">👵</span>
          </div>
          <button 
            onClick={fetchTasks} 
            className="p-3 rounded-full hover:bg-cream-100 transition-colors text-slate-600"
            title="Refresh List"
          >
            <RefreshCw className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Main Checklist Container */}
      <main className="max-w-2xl mx-auto w-full px-6 py-12 flex-1 flex flex-col justify-start">
        {/* Status notification toast */}
        {message && (
          <div className={`p-6 rounded-2xl mb-8 border text-lg font-bold shadow-sm flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {message.type === 'success' ? <Check className="h-6 w-6 stroke-[3]" /> : <AlertCircle className="h-6 w-6 stroke-[3]" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-xs underline font-semibold">Dismiss</button>
          </div>
        )}

        <div className="mb-6">
          <p className="text-slate-500 text-lg font-bold">TODAY&apos;S TASKS</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xl text-slate-500 font-bold">
            Loading your list...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cream-300 p-12 text-center shadow-sm">
            <span className="text-5xl mb-4 block">🎉</span>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">All tasks done!</h3>
            <p className="text-slate-600 text-lg">Have a wonderful day, Aino.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {tasks.map(task => {
              const isCompleted = task.status === 'completed' || task.status === 'resolved';
              const isHelp = task.status === 'needs_help';
              const isOverdue = task.status === 'overdue' || task.status === 'escalated_to_saara' || task.status === 'retry_queued';

              const formattedTime = new Date(task.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={task.id} 
                  className={`bg-white rounded-2xl border border-cream-300 p-6 shadow-sm flex flex-col gap-6 transition-all ${
                    isCompleted ? 'opacity-60 border-emerald-200 bg-emerald-50/10' : ''
                  } ${isHelp ? 'border-red-300 bg-red-50/10' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs uppercase font-extrabold tracking-wider bg-cream-200 text-slate-600 px-3 py-1 rounded-full">
                        {task.category}
                      </span>
                      <h2 className="text-2xl font-extrabold text-slate-800 mt-2.5">
                        {task.title}
                      </h2>
                      <p className="text-slate-600 text-lg mt-1">
                        Due around <strong className="text-slate-800 font-bold">{formattedTime}</strong>
                      </p>
                      {task.description && (
                        <p className="text-slate-500 text-sm italic mt-2">
                          Note: {task.description}
                        </p>
                      )}
                    </div>

                    <div>
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm">
                          <Check className="h-4 w-4 stroke-[3]" /> Done
                        </span>
                      )}
                      {isHelp && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-100 text-red-800 font-bold text-sm">
                          <AlertCircle className="h-4 w-4 stroke-[3]" /> Help Requested
                        </span>
                      )}
                      {!isCompleted && !isHelp && isOverdue && (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 font-bold text-sm">
                          🔔 Late
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCompleted && !isHelp && (
                    <div className="flex sm:flex-row flex-col gap-4">
                      {/* Big Complete Button */}
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xl font-black py-5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5"
                      >
                        <Check className="h-6 w-6 stroke-[3]" />
                        I did this
                      </button>

                      {/* Big Help Button */}
                      <button
                        onClick={() => handleNeedHelp(task.id)}
                        className="bg-red-50 hover:bg-red-100 border-2 border-red-200 active:scale-98 text-red-700 text-lg font-extrabold py-5 px-6 rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <HelpCircle className="h-5 w-5 text-red-600 stroke-[2.5]" />
                        I need help
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Access Help Contact Details */}
      <footer className="bg-white border-t border-cream-300 py-8 px-6 text-center">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-2 text-slate-500 font-semibold text-lg">
          <Heart className="h-5 w-5 text-emerald-600 fill-current" />
          <span>Saara&apos;s Phone: +358 00 000 0002</span>
        </div>
      </footer>
    </div>
  );
}
