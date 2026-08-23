import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, LoadingSpinner, Alert } from '../../components/ui/Alert';
import { Mail, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function AdminSystemPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['email-jobs'],
    queryFn: () => adminApi.getEmailJobs().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const jobs = data?.jobs || [];

  const statusVariant = (status: string) => {
    if (status === 'SENT') return 'green';
    if (status === 'PENDING') return 'yellow';
    if (status === 'FAILED') return 'red';
    return 'gray';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">System Status</h1>
          <p className="page-subtitle">Email jobs and background task monitoring</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <Alert type="info">
        This panel shows the email job queue. Failed jobs are automatically retried every 5 minutes. The system uses a DB-based fallback if Redis is unavailable.
      </Alert>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Sent',
            count: jobs.filter((j: any) => j.status === 'SENT').length,
            icon: <CheckCircle className="w-5 h-5" />,
            color: 'text-emerald-600 bg-emerald-100',
          },
          {
            label: 'Pending',
            count: jobs.filter((j: any) => j.status === 'PENDING').length,
            icon: <Clock className="w-5 h-5" />,
            color: 'text-amber-600 bg-amber-100',
          },
          {
            label: 'Failed',
            count: jobs.filter((j: any) => j.status === 'FAILED').length,
            icon: <AlertTriangle className="w-5 h-5" />,
            color: 'text-red-600 bg-red-100',
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-sm text-slate-500">{s.label} Emails</p>
            </div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900">Email Jobs</h2>
        </div>
        {isLoading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : jobs.length === 0 ? (
          <EmptyState icon={<Mail className="w-8 h-8" />} title="No email jobs" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: any) => (
                <tr key={job.id}>
                  <td className="text-sm font-mono">{job.to}</td>
                  <td className="text-sm text-slate-600">{job.subject}</td>
                  <td>
                    <Badge variant={statusVariant(job.status) as any}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="text-slate-500">{job.attempts}</td>
                  <td className="text-slate-500 text-sm">
                    {format(parseISO(job.createdAt), 'MMM d, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
