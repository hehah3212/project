"use client";

import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import { useEffect, useState } from "react";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 25%", // 간격 넓힘
        borderBottom: "1px solid #e0e0e0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontWeight: 600, // 글자 두께 키움 (기존보다 약간 굵게)
          fontSize: "18px", // 필요시 폰트 크기도 조절 가능
          color: "#a855f7", // 보라색 강조 유지
        }}
      >
        📚 독서 챌린지
      </div>
      <div>
        {user && (
          <button
            onClick={handleLogout}
            style={{
              padding: "4px 12px",
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        )}
      </div>
    </div>
  );
}
