import { useState } from "react";
import { Mail, Lock, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function LoginPage() {
  const { login, isLoggingIn, resendVerification, isResendingVerification } = useAuthStore();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUnverifiedEmail("");
    const errorCode = await login(formData);
    if (errorCode === "EMAIL_UNVERIFIED") {
      setUnverifiedEmail(formData.email);
    }
  };

  return (
    <AuthBackground>
      <div className="relative w-[420px] bg-cream border border-ink/12 rounded-3xl p-10 shadow-[0_8px_40px_rgba(43,38,32,0.12)]">

        <div className="flex items-center justify-center gap-2 mb-3">
          <Link to="/" className="inline-flex items-center gap-2 text-ink hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-forest text-cream flex items-center justify-center shadow-sm">
              <MessageSquare className="w-4 h-4 fill-cream/20" />
            </div>
            <span className="font-serif font-bold text-lg tracking-tight text-ink">Chatterbox</span>
          </Link>
        </div>

        <h1 className="font-serif text-2xl font-semibold text-center text-ink mb-8">
          Sign In
        </h1>

        {/* Email-unverified notice */}
        {unverifiedEmail && (
          <div className="mb-5 p-4 rounded-xl bg-ochre/10 border border-ochre/30 text-sm">
            <p className="text-ochre mb-2">
              <span className="font-medium">Email not verified.</span> Please check your inbox for the verification link.
            </p>
            <button
              type="button"
              disabled={isResendingVerification}
              onClick={() => resendVerification(unverifiedEmail)}
              className="text-forest hover:underline disabled:opacity-50 text-xs"
            >
              {isResendingVerification ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-ink/40 size-5" />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-ink/40 size-5" />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-forest text-sm hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            disabled={isLoggingIn}
            className="w-full py-3 rounded-xl bg-forest text-cream font-medium hover:bg-forest/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? "Signing in…" : "Login"}
          </button>

          <p className="text-center text-ink/50 text-sm">
            Don't have an account?{
            }<Link to="/signup" className="text-forest ml-1 hover:underline">
              Sign up
            </Link>
          </p>

        </form>

      </div>
    </AuthBackground>
  );
}

export default LoginPage;