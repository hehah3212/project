"use client";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../utils/firebase";

export default function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <header className="bg-white p-4 shadow flex justify-between">
      <h1 className="text-xl font-bold text-purple-600">📚 독서 챌린지</h1>
      <button onClick={handleLogout} className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300">
        로그아웃
      </button>
    </header>
  );
}