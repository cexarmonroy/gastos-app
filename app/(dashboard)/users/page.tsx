"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { UserPlus, Shield, Loader2, Copy, Check, UserCog } from "lucide-react";
import { inviteUser, listUsers, updateUserRole } from "@/app/actions/users";

interface UserRow {
  id: string;
  email: string;
  role: Role;
  hasMembership: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  DIRECTIVA: "Directiva",
  USER: "Usuario",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [password, setPassword] = useState("");

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      setError("No tienes permisos para ver usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    setTempPassword(null);

    const result = await inviteUser({
      email,
      role,
      password: password.trim() || undefined,
    });

    if (result.success) {
      setSuccess(`Usuario ${result.email} creado correctamente.`);
      if (result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
      }
      setEmail("");
      setPassword("");
      setRole("USER");
      await loadUsers();
    } else {
      setError(result.error);
    }

    setIsSubmitting(false);
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    const result = await updateUserRole({ userId, role: newRole });
    if (result.success) {
      await loadUsers();
    } else {
      setError(result.error);
    }
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" />
          Gestión de usuarios
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Invita usuarios para que puedan iniciar sesión con credenciales o Google.
        </p>
      </div>

      <div className="glass-panel p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Invitar usuario
        </h2>

        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="apoderado@ejemplo.cl"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-[#1a1d2e]">
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              Contraseña temporal (opcional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="Se genera automáticamente si se deja vacío"
              minLength={8}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          {tempPassword && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
              <p className="text-amber-200 mb-2">
                Contraseña temporal (cópiala ahora, no se volverá a mostrar):
              </p>
              <div className="flex items-center gap-2">
                <code className="text-white font-mono">{tempPassword}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="p-1 text-white/60 hover:text-white"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              "Crear usuario"
            )}
          </button>
        </form>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Usuarios registrados</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/50 border-b border-white/10">
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Rol</th>
                  <th className="text-left py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white">{user.email}</td>
                    <td className="py-3 pr-4">
                      <span className="text-white/80">{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td className="py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value} className="bg-[#1a1d2e]">
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
