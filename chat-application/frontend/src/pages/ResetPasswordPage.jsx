import { useState } from "react";
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
      <div className="relative w-[420px] bg-cream border border-ink/12 rounded-3xl p-10 shadow-[0_8px_40px_rgba(43,38,32,0.12)]">
        <h1 className="font-serif text-3xl font-semibold text-center text-ink mb-2">
          Reset Password
        </h1>
        <p className="text-ink/50 text-sm text-center mb-8">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-ink/40 size-5" />
            <input
              type="password"
              placeholder="New password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-ink/40 size-5" />
            <input
              type="password"
              placeholder="Confirm new password"
              value={formData.confirm}
              onChange={(e) => setFormData({ ...formData, confirm: e.target.value })}
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          {validationError && (
            <p className="text-rust text-sm text-center">{validationError}</p>
          )}

          <button
            disabled={isResettingPassword}
            className="w-full py-3 rounded-xl bg-forest text-cream font-medium hover:bg-forest/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResettingPassword ? "Resetting…" : "Reset Password"}
          </button>

          <p className="text-center text-ink/50 text-sm">
            <Link to="/login" className="text-forest hover:underline">
              Back to Login
            </Link>
          </p>
        </form>
      </div>
    </AuthBackground>
  );
}

export default ResetPasswordPage;
