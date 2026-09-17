import { Link, useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Lock,
  Zap,
  Users,
  ShieldCheck,
  Image,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Key,
  Shield,
  FileKey,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

function HomePage() {
  const { authUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const setTab = (tab) => {
    if (tab === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  return (
    <div className="min-h-screen bg-oat text-ink font-sans flex flex-col relative overflow-x-hidden selection:bg-forest/20 selection:text-forest">
      {/* Ambient background glow shapes */}
      <div className="absolute w-[600px] h-[600px] bg-ochre/15 rounded-full blur-[150px] -top-48 -left-48 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-forest/10 rounded-full blur-[130px] top-[30%] -right-48 pointer-events-none" />
      <div className="absolute w-[450px] h-[450px] bg-rust/8 rounded-full blur-[120px] -bottom-32 left-[20%] pointer-events-none" />

      {/* Top Navigation Bar — Expansive Width */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-oat/85 border-b border-ink/10 transition-colors">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 h-18 flex items-center justify-between">
          {/* Logo & Brand */}
          <button
            type="button"
            onClick={() => setTab("overview")}
            className="flex items-center gap-2.5 group text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-forest text-cream flex items-center justify-center shadow-md shadow-forest/20 group-hover:scale-105 transition-transform">
              <MessageSquare className="w-5 h-5 fill-cream/20" />
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight text-ink">
                Chatterbox
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">
                v1.0
              </span>
            </div>
          </button>

          {/* Navigation Tabs — Only Features & E-2-E Encryption */}
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTab("features")}
              className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all ${
                activeTab === "features"
                  ? "bg-forest/15 text-forest font-semibold shadow-xs"
                  : "text-ink/65 hover:text-ink hover:bg-ink/5"
              }`}
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => setTab("e2ee")}
              className={`px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${
                activeTab === "e2ee"
                  ? "bg-forest/15 text-forest font-semibold shadow-xs"
                  : "text-ink/65 hover:text-ink hover:bg-ink/5"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>E2E Encryption</span>
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {authUser ? (
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-forest text-cream font-medium text-xs sm:text-sm hover:bg-forest/90 shadow-sm hover:shadow transition-all"
              >
                <span>Go to Chat</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-ink/75 hover:text-ink hover:bg-ink/5 rounded-full transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full bg-forest text-cream hover:bg-forest/90 shadow-sm hover:shadow-md transition-all"
                >
                  <span>Sign Up</span>
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic View Container */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-12 py-8 sm:py-12">
        {/* ============================================================ */}
        {/* VIEW 1: BASE / OVERVIEW PAGE */}
        {/* ============================================================ */}
        {activeTab === "overview" && (
          <div className="animate-in fade-in duration-200">
            <div className="max-w-4xl mx-auto text-center">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cream border border-ink/12 shadow-xs text-xs font-medium text-forest mb-6">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero-Knowledge Encryption · Client-Side X25519 & AES-256-GCM</span>
              </div>

              {/* Headline */}
              <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-semibold text-ink tracking-tight leading-[1.15] mb-5">
                Private conversations, engineered for <span className="italic text-forest">speed</span> and{" "}
                <span className="italic text-forest">security</span>.
              </h1>

              {/* Subtitle */}
              <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-ink/65 font-normal leading-relaxed mb-8">
                <strong>Chatterbox</strong> combines client-side X25519 ECDH encryption with horizontal Redis scaling.
                Your direct messages stay strictly between you and your recipient — the server never sees plaintext.
              </p>

              {/* Primary Call-to-Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
                {authUser ? (
                  <Link
                    to="/chat"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3 rounded-full bg-forest text-cream font-medium text-sm sm:text-base hover:bg-forest/90 shadow-md hover:shadow-lg transition-all"
                  >
                    <span>Launch Web App</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/signup"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-forest text-cream font-medium text-sm sm:text-base hover:bg-forest/90 shadow-md hover:shadow-lg transition-all"
                    >
                      <span>Start Chatting Free</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3 rounded-full bg-cream border border-ink/15 text-ink font-medium text-sm sm:text-base hover:bg-cream/80 hover:border-ink/30 transition-all shadow-xs"
                    >
                      Sign In to Account
                    </Link>
                  </>
                )}
              </div>

              {/* Compact Interactive UI Mockup Showcase */}
              <div className="relative max-w-3xl mx-auto rounded-2xl border border-ink/15 bg-cream/90 backdrop-blur-md shadow-xl overflow-hidden p-3 text-left mb-6">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink/10 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rust/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-ochre/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-sage/60" />
                    <span className="ml-1.5 text-[11px] font-medium text-ink/40">Chatterbox Preview</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-forest font-medium bg-forest/10 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    <span>E2EE Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-oat/50 rounded-xl p-2.5 border border-ink/10">
                  {/* Mock Sidebar snippet */}
                  <div className="hidden md:block bg-cream rounded-lg p-2.5 border border-ink/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-ink/10">
                      <span className="font-serif font-semibold text-ink text-xs">Recent Chats</span>
                      <span className="text-[9px] font-bold text-cream bg-forest px-1.5 py-0.5 rounded-full">Online</span>
                    </div>
                    <div className="p-2 rounded-lg bg-forest/10 border border-forest/20 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-forest text-cream text-[11px] flex items-center justify-center font-bold">
                        A
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-ink truncate text-xs">Alice Doe</h4>
                        <p className="text-[10px] text-ink/50 truncate">See you at the meeting!</p>
                      </div>
                    </div>
                  </div>

                  {/* Mock Conversation snippet */}
                  <div className="md:col-span-2 bg-oat rounded-lg p-3 border border-ink/10 flex flex-col justify-between">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-start">
                        <div className="bg-cream text-ink px-3 py-1.5 rounded-xl rounded-bl-xs border border-ink/10 shadow-xs max-w-[85%] text-xs">
                          Hey! Are direct messages end-to-end encrypted here?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-forest text-cream px-3 py-1.5 rounded-xl rounded-br-xs shadow-xs max-w-[85%] flex flex-col items-end text-xs">
                          <p>Yes! Keys derived via Web Crypto ECDH. Plaintext never touches server. 🔒</p>
                          <span className="text-[9px] text-cream/70 mt-0.5">09:42 · ✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subpage Explorer Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2 text-xs text-ink/60">
                <span>Want to know more?</span>
                <button
                  type="button"
                  onClick={() => setTab("features")}
                  className="font-medium text-forest hover:underline flex items-center gap-1"
                >
                  <span>Explore Features</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setTab("e2ee")}
                  className="font-medium text-forest hover:underline flex items-center gap-1"
                >
                  <span>How Encryption Works</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: FEATURES PAGE */}
        {/* ============================================================ */}
        {activeTab === "features" && (
          <div className="animate-in fade-in duration-200 py-4">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-forest bg-forest/10 px-3 py-1 rounded-full">
                Platform Features
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mt-3 mb-2">
                Engineered for speed, privacy & collaboration
              </h2>
              <p className="text-ink/60 text-sm sm:text-base">
                Discover the technical capabilities that power the Chatterbox real-time platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {/* Feature 1 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Zero-Knowledge E2EE
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Direct messages are encrypted with X25519 ECDH & AES-256-GCM. Private keys are non-extractable and never leave your device.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>AES-256-GCM</span>
                  <span>12-Byte IV</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Real-Time WebSockets
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Full-duplex WebSocket architecture via Socket.io with live typing indicators, delivery checkmarks, and instant sync.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>Socket.io</span>
                  <span>Presence Sync</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Group Channels & Governance
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Organize team chats with custom group avatars. If an admin departs, the senior member is automatically promoted.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>Admin Auto-Promotion</span>
                  <span>Multi-User</span>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Horizontal Redis Scaling
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Multi-instance backend clustering using Redis pub/sub adapter with atomic presence sets and rolling TTL heartbeats.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>Redis Adapter</span>
                  <span>Multi-Node</span>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <Image className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Media Sharing & Lightbox
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Share photos directly in chat with inline previews, circular avatars, and click-to-view enlarged modal lightboxes.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>Cloudinary CDN</span>
                  <span>Photo Lightbox</span>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                    Edge Bot & Abuse Defense
                  </h3>
                  <p className="text-ink/60 text-xs sm:text-sm leading-relaxed">
                    Protected by Arcjet sliding-window rate limiting (100 req/min) and automated bot inspection with fail-open resiliency.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-ink/10 flex items-center justify-between text-xs text-forest font-medium">
                  <span>Arcjet Shield</span>
                  <span>Rate Limiting</span>
                </div>
              </div>
            </div>

            {/* Bottom Call to Action strip */}
            <div className="bg-cream border border-ink/15 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h4 className="font-serif font-semibold text-ink text-base">Ready to test these capabilities?</h4>
                <p className="text-xs text-ink/60">Create an account and test real-time messaging between two tabs.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTab("e2ee")}
                  className="px-4 py-2 rounded-full border border-ink/20 text-xs font-medium text-ink hover:bg-ink/5 transition-colors"
                >
                  View Encryption Details
                </button>
                <Link
                  to="/signup"
                  className="px-5 py-2 rounded-full bg-forest text-cream text-xs font-medium hover:bg-forest/90 shadow-xs transition-colors"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: E2E ENCRYPTION DEEP DIVE */}
        {/* ============================================================ */}
        {activeTab === "e2ee" && (
          <div className="animate-in fade-in duration-200 py-4 max-w-4xl mx-auto w-full">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-forest bg-forest/10 px-3 py-1 rounded-full">
                Cryptographic Protocol
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-ink mt-3 mb-2">
                How Chatterbox secures your direct messages
              </h2>
              <p className="text-ink/60 text-sm sm:text-base">
                An honest, zero-knowledge architecture designed so the server only ever acts as an encrypted ciphertext relay.
              </p>
            </div>

            {/* 3 Step Protocol Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                  <FileKey className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-forest uppercase tracking-wider mb-1">Step 1</div>
                <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                  Client Key Generation
                </h3>
                <p className="text-ink/60 text-xs leading-relaxed">
                  Upon login, an <strong>X25519</strong> keypair is generated via the native Web Crypto API. The private key is flagged with <code>extractable: false</code> and stored in browser IndexedDB.
                </p>
              </div>

              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                  <Key className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-forest uppercase tracking-wider mb-1">Step 2</div>
                <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                  ECDH Shared Agreement
                </h3>
                <p className="text-ink/60 text-xs leading-relaxed">
                  When you open a direct chat, your private key and recipient's public key mathematically derive an identical <strong>256-bit AES</strong> symmetric key without sending keys over the network.
                </p>
              </div>

              <div className="bg-cream rounded-2xl p-5 border border-ink/12 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-forest/10 text-forest flex items-center justify-center mb-3">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="text-[11px] font-bold text-forest uppercase tracking-wider mb-1">Step 3</div>
                <h3 className="font-serif text-base font-semibold text-ink mb-1.5">
                  Fresh IV & AEAD Cipher
                </h3>
                <p className="text-ink/60 text-xs leading-relaxed">
                  Every text message generates a random <strong>12-byte IV</strong>. Plaintext is encrypted with <strong>AES-256-GCM</strong> (AEAD). The server only stores ciphertext and IV.
                </p>
              </div>
            </div>

            {/* Security Guarantee Box */}
            <div className="bg-cream border border-ink/15 rounded-2xl p-6 shadow-md mb-6">
              <div className="flex items-center gap-2.5 pb-3 border-b border-ink/10 mb-4">
                <Shield className="w-5 h-5 text-forest" />
                <h3 className="font-serif text-lg font-semibold text-ink">
                  Security Guarantees & Transparency
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-forest flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-forest" /> What It Protects
                  </h4>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Database Snooping:</strong> Server operators and DB admins cannot read your direct message text.
                  </p>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Tamper-Proof:</strong> AES-GCM authentication tags detect any message alteration in transit.
                  </p>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Non-Extractable:</strong> Browser scripts cannot export your raw private key bytes.
                  </p>
                </div>
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-ink/80 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-ochre" /> System Boundaries
                  </h4>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Single-Device:</strong> Keys live in local IndexedDB; clearing browser storage resets your local keys.
                  </p>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Direct Messages:</strong> E2EE covers 1:1 text messages (group chats are open channels).
                  </p>
                  <p className="text-ink/70 leading-relaxed">
                    • <strong>Visible Metadata:</strong> Timestamps and sender/receiver IDs are processed for delivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setTab("overview")}
                className="text-xs font-medium text-ink/60 hover:text-ink transition-colors"
              >
                ← Back to Home
              </button>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-forest text-cream font-medium text-xs sm:text-sm hover:bg-forest/90 shadow-sm transition-all"
              >
                <span>Experience E2EE Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-ink/10 bg-cream/60 py-6 px-6 sm:px-10 lg:px-12 text-xs text-ink/50 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-forest text-cream flex items-center justify-center font-bold text-[10px]">
              C
            </div>
            <span className="font-serif font-semibold text-ink text-xs">Chatterbox</span>
            <span>· Private Real-Time Chat Platform</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-medium text-ink/60">
            <span>React 19</span>
            <span>•</span>
            <span>Web Crypto</span>
            <span>•</span>
            <span>Socket.io</span>
            <span>•</span>
            <span>Redis</span>
            <span>•</span>
            <span>MongoDB</span>
          </div>

          <p>© {new Date().getFullYear()} Chatterbox. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
