import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { navigate("/"); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#1A1A1A] flex items-center justify-center px-4" data-testid="login-page">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#D4AF37] rounded-sm flex items-center justify-center mx-auto mb-4">
            <span className="text-[#1A1A1A] font-black text-lg" style={{ fontFamily: 'Chivo' }}>S</span>
          </div>
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo' }}>Welcome Back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-sm px-3 py-2 text-xs text-red-400" data-testid="login-error">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-xs text-white/60 mb-1.5 block">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#2A2A2A] border-white/10 text-white focus:ring-[#D4AF37] focus:border-[#D4AF37] h-10"
              placeholder="you@restaurant.com"
              data-testid="login-email-input"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-xs text-white/60 mb-1.5 block">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[#2A2A2A] border-white/10 text-white focus:ring-[#D4AF37] focus:border-[#D4AF37] h-10 pr-10"
                placeholder="Enter password"
                data-testid="login-password-input"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold h-10" data-testid="login-submit">
            {loading ? "Signing in..." : "SIGN IN"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
          <div className="relative flex justify-center text-[10px]"><span className="bg-[#1A1A1A] px-3 text-white/30">OR</span></div>
        </div>

        <Button
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full border-white/10 text-white hover:bg-white/5 rounded-sm h-10 text-sm"
          data-testid="google-login-button"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </Button>

        <p className="text-center text-xs text-white/40 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-[#D4AF37] hover:underline" data-testid="login-register-link">Create one</Link>
        </p>
      </div>
    </div>
  );
}
