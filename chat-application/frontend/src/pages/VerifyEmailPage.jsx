import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

/**
 * VerifyEmailPage
 *
 * Reached via the link in the verification email:
 *   ${CLIENT_URL}/verify-email/:token
 *
 * On mount, POSTs the raw token to the backend. If valid, the backend issues
 * a JWT cookie and returns the user object — we set authUser and navigate to /.
 * On failure, shows an error with a resend form.
 */
function VerifyEmailPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification, isResendingVerification } = useAuthStore();

  const [status, setStatus] = useState("verifying"); // "verifying" | "success" | "error"
  const [resendEmail, setResendEmail] = useState("");
  const attemptedTokenRef = useRef(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    // React Strict Mode replays effects in development. A verification token is
    // single-use, so issuing two requests would make the second request report
    // a false "expired" error.
    if (attemptedTokenRef.current === token) {
      return () => clearTimeout(redirectTimerRef.current);
    }
    attemptedTokenRef.current = token;

    verifyEmail(token).then((ok) => {
      if (attemptedTokenRef.current !== token) return;
      if (ok) {
        setStatus("success");
        // Brief delay so the user sees the success message before redirect
        redirectTimerRef.current = setTimeout(() => navigate("/"), 1500);
      } else {
        setStatus("error");
      }
    });

    return () => clearTimeout(redirectTimerRef.current);
  }, [navigate, token, verifyEmail]);

  return (
    <AuthBackground>
      <div className="relative w-[420px] backdrop-blur-xl bg-white/5 border border-white/20 rounded-3xl p-10 shadow-2xl text-center">

        {/* --- Verifying --- */}
        {status === "verifying" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Verifying your email…</h1>
            <p className="text-gray-400 text-sm mt-2">This will only take a moment.</p>
          </>
        )}

        {/* --- Success --- */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 text-3xl flex items-center justify-center">
              ✅
            </div>
            <h1 className="text-xl font-semibold text-white">Email verified!</h1>
            <p className="text-gray-400 text-sm mt-2">Logging you in…</p>
          </>
        )}

        {/* --- Error --- */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 text-3xl flex items-center justify-center">
              ❌
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Link invalid or expired</h1>
            <p className="text-gray-400 text-sm mb-6">
              The verification link has expired or has already been used. Enter your email below to get a new one.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await resendVerification(resendEmail);
              }}
              className="space-y-3"
            >
              <input
                type="email"
                required
                placeholder="Your email address"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-sm"
              />
              <button
                type="submit"
                disabled={isResendingVerification}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition"
              >
                {isResendingVerification ? "Sending…" : "Resend verification email"}
              </button>
            </form>

            <p className="mt-5 text-gray-500 text-xs">
              Already verified?{" "}
              <Link to="/login" className="text-cyan-400 hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}

      </div>
    </AuthBackground>
  );
}

export default VerifyEmailPage;
