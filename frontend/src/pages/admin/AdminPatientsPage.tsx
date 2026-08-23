import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { Users, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function AdminPatientsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-patients', search],
    queryFn: () =>
      adminApi.getPatients({ search: search || undefined }).then((r) => r.data.data),
  });

  const patients = data?.patients || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Patients</h1>
        <p className="page-subtitle">Registered patient accounts</p>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No patients found"
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Blood Group</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {p.user.firstName[0]}{p.user.lastName[0]}
                      </div>
                      <span className="font-medium text-slate-900">
                        {p.user.firstName} {p.user.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="text-slate-600">{p.user.email}</td>
                  <td>{p.phone || '—'}</td>
                  <td>{p.bloodGroup || '—'}</td>
                  <td className="text-slate-500 text-sm">
                    {format(parseISO(p.user.createdAt), 'MMM d, yyyy')}
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
