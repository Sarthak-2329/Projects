import React, { useState } from "react";
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
      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl">
        <h1 className="text-3xl font-semibold text-center text-white mb-2">
          Forgot Password
        </h1>

        {submitted ? (
          <div className="mt-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto">
              <Mail className="text-cyan-400 size-8" />
            </div>
            <p className="text-slate-300 text-sm">
              If that email is registered, a reset link has been sent. Check your inbox (and spam folder).
            </p>
            <Link to="/login" className="text-cyan-400 text-sm hover:underline block">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-sm text-center mb-8">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-gray-400 size-5" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <button
                disabled={isRequestingReset}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition shadow-lg disabled:opacity-60"
              >
                {isRequestingReset ? "Sending…" : "Send Reset Link"}
              </button>

              <p className="text-center text-gray-400 text-sm">
                Remembered it?{" "}
                <Link to="/login" className="text-cyan-400 hover:underline">
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
