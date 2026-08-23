import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert, EmptyState, LoadingSpinner, Modal } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Plus, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminSpecializationsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-specializations'],
    queryFn: () => adminApi.getSpecializations().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createSpecialization({ name, description }),
    onSuccess: () => {
      toast.success('Specialization created');
      setModal(false);
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin-specializations'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });

  const specs = data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Specializations</h1>
          <p className="page-subtitle">Manage medical specializations</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <Plus className="w-4 h-4" /> Add Specialization
        </Button>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : specs.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-8 h-8" />}
            title="No specializations yet"
            action={<Button onClick={() => setModal(true)}>Add First Specialization</Button>}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s: any) => (
                <tr key={s.id}>
                  <td className="font-medium text-slate-900">{s.name}</td>
                  <td className="text-slate-500">{s.description || '—'}</td>
                  <td><Badge variant="green">Active</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title="Add Specialization" size="sm">
        <div className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Cardiology"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Description"
            placeholder="Brief description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancel</Button>
            <Button
              className="flex-1"
              isLoading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
