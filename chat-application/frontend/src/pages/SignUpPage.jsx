import { useState } from "react";
import { Mail, Lock, User } from "lucide-react";
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

  // ---- "Check your inbox" state (after successful signup) ----
  if (pendingVerificationEmail) {
    return (
      <AuthBackground>
        <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-3xl">
            ✉️
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">Check your inbox</h1>
          <p className="text-gray-400 text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="text-cyan-400 font-medium mb-6 break-all">{pendingVerificationEmail}</p>
          <p className="text-gray-500 text-xs mb-8">
            Click the link in the email to verify your account and start chatting. The link expires in 24 hours.
          </p>
          <button
            type="button"
            disabled={isResendingVerification}
            onClick={() => resendVerification(pendingVerificationEmail)}
            className="w-full py-2.5 rounded-xl border border-white/20 text-gray-300 hover:text-white hover:border-cyan-500/60 text-sm transition"
          >
            {isResendingVerification ? "Sending…" : "Resend verification email"}
          </button>
          <p className="mt-5 text-gray-500 text-xs">
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => useAuthStore.setState({ pendingVerificationEmail: null })}
              className="text-cyan-400 hover:underline"
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
      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl">

        <h1 className="text-3xl font-semibold text-center text-white mb-8">
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="relative">
            <User className="absolute left-3 top-3.5 text-gray-400 size-5"/>
            <input
              type="text"
              placeholder="Full name"
              value={formData.fullName}
              onChange={(e)=>setFormData({...formData,fullName:e.target.value})}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-gray-400 size-5"/>
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e)=>setFormData({...formData,email:e.target.value})}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400 size-5"/>
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e)=>setFormData({...formData,password:e.target.value})}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <button
            disabled={isSigningUp}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition shadow-lg"
          >
            {isSigningUp ? "Creating…" : "Create Account"}
          </button>

          <p className="text-center text-gray-400 text-sm">
            Already have an account?
            <Link to="/login" className="text-cyan-400 ml-1 hover:underline">
              Login
            </Link>
          </p>

        </form>

      </div>
    </AuthBackground>
  );
}

export default SignupPage;