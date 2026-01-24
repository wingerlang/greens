import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import { Link, useNavigate } from "react-router-dom";

export function LoginPage() {
  const { login, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (e) {
      // Error managed by context/local state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-2xl font-black text-white">Logga in</h1>
          <p className="text-slate-400 mt-2">Välkommen tillbaka till Greens</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-4 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Användarnamn
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              placeholder="Ange användarnamn"
            />
          </div>
          <div>
            <label className="block text text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Lösenord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              placeholder="Ditt lösenord"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 mt-6"
          >
            {isSubmitting ? "Loggar in..." : "Logga in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 font-medium">
          Inget konto?{" "}
          <Link
            to="/register"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Skapa ett konto
          </Link>
        </div>
      </div>
    </div>
  );
}
