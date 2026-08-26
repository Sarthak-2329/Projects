import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function LoginPage() {
  const { login, isLoggingIn, resendVerification, isResendingVerification } = useAuthStore();

  const [formData, setFormData] = useState({ email: "", password: "" });
  /**
   * Set to the user's email when the backend returns EMAIL_UNVERIFIED.
   * Causes a notice banner with a resend link to appear above the form.
   */
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
      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl">

        <h1 className="text-3xl font-semibold text-center text-white mb-8">
          Sign In
        </h1>

        {/* Email-unverified notice */}
        {unverifiedEmail && (
          <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
            <p className="text-amber-300 mb-2">
              <span className="font-medium">Email not verified.</span> Please check your inbox for the verification link.
            </p>
            <button
              type="button"
              disabled={isResendingVerification}
              onClick={() => resendVerification(unverifiedEmail)}
              className="text-cyan-400 hover:underline disabled:opacity-50 text-xs"
            >
              {isResendingVerification ? "Sending…" : "Resend verification email →"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-gray-400 size-5" />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e)=>setFormData({...formData,email:e.target.value})}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-gray-400 size-5" />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e)=>setFormData({...formData,password:e.target.value})}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-cyan-400 text-sm hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            disabled={isLoggingIn}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition shadow-lg"
          >
            {isLoggingIn ? "Signing in…" : "Login"}
          </button>

          <p className="text-center text-gray-400 text-sm">
            Don't have an account?
            <Link to="/signup" className="text-cyan-400 ml-1 hover:underline">
              Sign up
            </Link>
          </p>

        </form>

      </div>
    </AuthBackground>
  );
}

export default LoginPage;