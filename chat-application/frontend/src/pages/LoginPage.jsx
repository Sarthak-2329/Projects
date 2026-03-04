import React, { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function LoginPage() {

  const { login, isLoggingIn } = useAuthStore();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <AuthBackground>

      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl">

        <h1 className="text-3xl font-semibold text-center text-white mb-8">
          Sign In
        </h1>

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

          <button
            disabled={isLoggingIn}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition shadow-lg"
          >
            {isLoggingIn ? "Signing in..." : "Login"}
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