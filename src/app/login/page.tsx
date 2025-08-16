"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인되어 있으면 홈으로
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) router.replace("/");
    });
    return () => unsub();
  }, [router]);

  // 공용 레거시 키만 정리 (계정별 키는 유지)
  const clearLegacyLocalKeys = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k === "book-list" || k.startsWith("reading-")) {
        localStorage.removeItem(k);
      }
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      clearLegacyLocalKeys();
      // 여기서 router.replace("/") 하지 않음 → onAuthStateChanged가 처리
    } catch (err: any) {
      setError(err?.message || "로그인에 실패했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-80 space-y-4">
        <h2 className="text-xl font-bold">로그인</h2>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          autoComplete="current-password"
          required
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full p-2 rounded text-white ${submitting ? "bg-gray-400" : "bg-yellow-400 hover:bg-yellow-500"}`}
        >
          {submitting ? "로그인 중…" : "로그인"}
        </button>

        <p className="text-sm text-center mt-4">
          아직 계정이 없으신가요?{" "}
          <a href="/register" className="text-blue-500 hover:underline">회원가입</a>
        </p>
      </form>
    </div>
  );
}
