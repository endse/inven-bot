"use client";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        toast.error(data.error || 'Failed to fetch users');
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleStatusUpdate = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/users/${id}/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${action}d successfully`);
        fetchUsers();
      } else {
        toast.error(data.error || `Failed to ${action} user`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('User deleted successfully');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Manage Users</h1>
        <p className="text-sm text-gray-500">Approve or reject pending user registrations.</p>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mr-3">
                      {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name || 'No name'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    {user.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(user.id, 'approve')}
                          className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded-md transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(user.id, 'reject')}
                          className="text-yellow-600 hover:text-yellow-900 bg-yellow-50 px-3 py-1 rounded-md transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {user.status === 'REJECTED' && (
                      <button
                        onClick={() => handleStatusUpdate(user.id, 'approve')}
                        className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded-md transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
