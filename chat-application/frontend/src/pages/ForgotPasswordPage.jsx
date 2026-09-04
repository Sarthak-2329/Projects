import { useState } from "react";
import { Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function ForgotPasswordPage() {
  const { forgotPassword, isRequestingReset } = useAuthStore();

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await forgotPassword(email);
    if (ok) setSubmitted(true);
  };

  return (
    <AuthBackground>
      <div className="relative w-[420px] bg-cream border border-ink/12 rounded-3xl p-10 shadow-[0_8px_40px_rgba(43,38,32,0.12)]">
        <h1 className="font-serif text-3xl font-semibold text-center text-ink mb-2">
          Forgot Password
        </h1>

        {submitted ? (
          <div className="mt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center mx-auto">
              <Mail className="text-forest size-8" />
            </div>
            <p className="text-ink/60 text-sm">
              If that email is registered, a reset link has been sent. Check your inbox (and spam folder).
            </p>
            <Link to="/login" className="text-forest text-sm hover:underline block">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-ink/50 text-sm text-center mb-8">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-ink/40 size-5" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest transition"
                />
              </div>

              <button
                disabled={isRequestingReset}
                className="w-full py-3 rounded-xl bg-forest text-cream font-medium hover:bg-forest/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRequestingReset ? "Sending…" : "Send Reset Link"}
              </button>

              <p className="text-center text-ink/50 text-sm">
                Remembered it?{" "}
                <Link to="/login" className="text-forest hover:underline">
                  Back to Login
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </AuthBackground>
  );
}

export default ForgotPasswordPage;
