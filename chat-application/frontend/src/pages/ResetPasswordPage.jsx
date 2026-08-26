import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { resetPassword, isResettingPassword } = useAuthStore();

  const [formData, setFormData] = useState({ password: "", confirm: "" });
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (formData.password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }
    if (formData.password !== formData.confirm) {
      setValidationError("Passwords do not match.");
      return;
    }

    const ok = await resetPassword(token, formData.password);
    if (ok) navigate("/login");
  };

  return (
    <AuthBackground>
      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl">
        <h1 className="text-3xl font-semibold text-center text-white mb-2">
          Reset Password
        </h1>
        <p className="text-slate-400 text-sm text-center mb-8">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400 size-5" />
            <input
              type="password"
              placeholder="New password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400 size-5" />
            <input
              type="password"
              placeholder="Confirm new password"
              value={formData.confirm}
              onChange={(e) => setFormData({ ...formData, confirm: e.target.value })}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          {validationError && (
            <p className="text-red-400 text-sm text-center">{validationError}</p>
          )}

          <button
            disabled={isResettingPassword}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition shadow-lg disabled:opacity-60"
          >
            {isResettingPassword ? "Resetting…" : "Reset Password"}
          </button>

          <p className="text-center text-gray-400 text-sm">
            <Link to="/login" className="text-cyan-400 hover:underline">
              Back to Login
            </Link>
          </p>
        </form>
      </div>
    </AuthBackground>
  );
}

export default ResetPasswordPage;
