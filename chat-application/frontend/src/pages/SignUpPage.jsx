import { useState } from "react";
import { Mail, Lock, User, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function SignupPage() {
  const { signup, isSigningUp, pendingVerificationEmail, resendVerification, isResendingVerification } = useAuthStore();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    signup(formData);
  };

  // ---- "Check your inbox" state ----
  if (pendingVerificationEmail) {
    return (
      <AuthBackground>
        <div className="relative w-[420px] bg-cream border border-ink/12 rounded-3xl p-10 shadow-[0_8px_40px_rgba(43,38,32,0.12)] text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-forest/10 flex items-center justify-center text-3xl">
            ✉️
          </div>
          <h1 className="font-serif text-2xl font-semibold text-ink mb-3">Check your inbox</h1>
          <p className="text-ink/50 text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="text-forest font-medium mb-6 break-all">{pendingVerificationEmail}</p>
          <p className="text-ink/40 text-xs mb-8">
            Click the link in the email to verify your account and start chatting. The link expires in 24 hours.
          </p>
          <button
            type="button"
            disabled={isResendingVerification}
            onClick={() => resendVerification(pendingVerificationEmail)}
            className="w-full py-2.5 rounded-xl border border-ink/20 text-ink/70 hover:text-ink hover:border-forest/50 text-sm transition bg-oat"
          >
            {isResendingVerification ? "Sending…" : "Resend verification email"}
          </button>
          <p className="mt-5 text-ink/40 text-xs">
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => useAuthStore.setState({ pendingVerificationEmail: null })}
              className="text-forest hover:underline"
            >
              Go back
            </button>
          </p>
        </div>
      </AuthBackground>
    );
  }

  // ---- Sign-up form ----
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
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="relative">
            <User className="absolute left-3 top-3.5 text-ink/40 size-5"/>
            <input
              type="text"
              placeholder="Full name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-ink/40 size-5"/>
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-ink/40 size-5"/>
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
            />
          </div>

          <button
            disabled={isSigningUp}
            className="w-full py-3 rounded-xl bg-forest text-cream font-medium hover:bg-forest/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningUp ? "Creating…" : "Create Account"}
          </button>

          <p className="text-center text-ink/50 text-sm">
            Already have an account?{
            }<Link to="/login" className="text-forest ml-1 hover:underline">
              Login
            </Link>
          </p>

        </form>

      </div>
    </AuthBackground>
  );
}

export default SignupPage;