// src/app/components/Header.tsx
"use client";

import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import { useEffect, useState } from "react";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [hoverLogout, setHoverLogout] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 현 uid에 해당하는 로컬 키 정리
  const clearLocalForUser = (uid: string) => {
    const prefixes = [`book-list:${uid}`, `reading:${uid}:`];
    Object.keys(localStorage).forEach((k) => {
      if (
        k === "book-list" || // 구버전 키
        k.startsWith("reading-") || // 구버전 키
        prefixes.some((p) => k.startsWith(p))
      ) {
        localStorage.removeItem(k);
      }
    });
    localStorage.removeItem("pending-delta");
    localStorage.removeItem("user");
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      const u = auth.currentUser;
      if (u) clearLocalForUser(u.uid);
    } finally {
      await signOut(auth);
      router.replace("/login"); // 빠른 언마운트
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 25%",
        borderBottom: "1px solid #e0e0e0",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontWeight: 600,
          fontSize: "18px",
          color: "#a855f7",
        }}
      >
        📚 독서 챌린지
      </div>

      <div>
        {user && (
          <button
            onClick={handleLogout}
            onMouseEnter={() => setHoverLogout(true)}
            onMouseLeave={() => setHoverLogout(false)}
            onFocus={() => setHoverLogout(true)}
            onBlur={() => setHoverLogout(false)}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer",
              transition: "all .2s ease",
              background: hoverLogout ? "#ef4444" : "#ffffff",
              color: hoverLogout ? "#ffffff" : "#111827",
              border: `1px solid ${hoverLogout ? "#ef4444" : "#d1d5db"}`,
              transform: hoverLogout ? "scale(1.05)" : "scale(1)",
              boxShadow: hoverLogout ? "0 6px 16px rgba(239,68,68,.35)" : "none",
            }}
            aria-label="로그아웃"
          >
            로그아웃
          </button>
        )}
      </div>
    </div>
  );
}
