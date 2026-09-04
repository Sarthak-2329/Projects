import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthBackground from "../components/AuthBackground";

function VerifyEmailPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification, isResendingVerification } = useAuthStore();

  const [status, setStatus] = useState("verifying");
  const [resendEmail, setResendEmail] = useState("");
  const attemptedTokenRef = useRef(null);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    if (attemptedTokenRef.current === token) {
      return () => clearTimeout(redirectTimerRef.current);
    }
    attemptedTokenRef.current = token;

    verifyEmail(token).then((ok) => {
      if (attemptedTokenRef.current !== token) return;
      if (ok) {
        setStatus("success");
        redirectTimerRef.current = setTimeout(() => navigate("/"), 1500);
      } else {
        setStatus("error");
      }
    });

    return () => clearTimeout(redirectTimerRef.current);
  }, [navigate, token, verifyEmail]);

  return (
    <AuthBackground>
      <div className="relative w-[420px] bg-cream border border-ink/12 rounded-3xl p-10 shadow-[0_8px_40px_rgba(43,38,32,0.12)] text-center">

        {/* Verifying */}
        {status === "verifying" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-forest/10 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-forest" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink">Verifying your email…</h1>
            <p className="text-ink/50 text-sm mt-2">This will only take a moment.</p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sage/15 text-3xl flex items-center justify-center">
              ✅
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink">Email verified!</h1>
            <p className="text-ink/50 text-sm mt-2">Logging you in…</p>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rust/10 text-3xl flex items-center justify-center">
              ❌
            </div>
            <h1 className="font-serif text-xl font-semibold text-ink mb-2">Link invalid or expired</h1>
            <p className="text-ink/50 text-sm mb-6">
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
                className="w-full px-4 py-3 rounded-xl bg-oat border border-ink/20 text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-forest text-sm transition"
              />
              <button
                type="submit"
                disabled={isResendingVerification}
                className="w-full py-3 rounded-xl bg-forest text-cream font-medium hover:bg-forest/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResendingVerification ? "Sending…" : "Resend verification email"}
              </button>
            </form>

            <p className="mt-5 text-ink/40 text-xs">
              Already verified?{" "}
              <Link to="/login" className="text-forest hover:underline">
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
