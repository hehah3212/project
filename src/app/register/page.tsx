"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "firebase/auth";
import { auth, db } from "../utils/firebase"; // ✅ db 추가
import { doc, setDoc } from "firebase/firestore"; // ✅ Firestore 함수 추가

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      alert("인증 메일을 보냈습니다. 이메일을 확인해주세요.");

      const user = result.user;

      // ✅ Firestore에 유저 정보 저장
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        nickname: "닉네임예시", // 나중에 사용자 입력 받으면 여기에 연결
        totalPagesRead: 0,
        lastReadDate: new Date().toISOString()
      });

      localStorage.setItem("user", user.email || "");
      router.push("/");
    } catch (error: any) {
      alert("회원가입 실패: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow w-80 space-y-4">
        <h2 className="text-xl font-bold">회원가입</h2>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-white p-2 rounded">
          회원가입
        </button>
        <p className="text-sm text-center">
          이미 계정이 있다면{" "}
          <a href="/login" className="text-blue-500 hover:underline">로그인</a>
        </p>
      </form>
    </div>
  );
}

