// src/app/books/BookDetailPage.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import Image from "next/image";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function BookDetailPage() {
  const { id } = useParams();
  const cleanId = decodeURIComponent(String(id)).split(" ")[0];

  const [book, setBook] = useState<any>(null);
  const [summary, setSummary] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [readPages, setReadPages] = useState(0);
  const [totalPages, setTotalPages] = useState(320);
  const [prevPages, setPrevPages] = useState(0);

  // ⭐ 별점 상태
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const safeReadPages = Math.min(readPages, totalPages);

  useEffect(() => {
    const localBooks = localStorage.getItem("book-list");
    if (localBooks) {
      const parsed = JSON.parse(localBooks);
      const matched = parsed.find((b: any) => b.isbn === cleanId);
      if (matched) setBook(matched);
    }
  }, [cleanId]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || !cleanId) return;
      const ref = doc(db, "users", user.uid, "books", cleanId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setSummary(data.summary || "");
        setThoughts(data.thoughts || "");
        setReadPages(data.readPages || 0);
        setPrevPages(data.readPages || 0);
        setTotalPages(data.totalPages || 320);
        setRating(data.rating || 0); // ⭐ 저장된 별점 반영
        setBook((prev: any) => prev || data);
      }
    });
    return () => unsubscribe();
  }, [cleanId]);

  // ⭐ 별 아이콘
  const Star = ({ filled }: { filled: boolean }) => (
    <svg
      viewBox="0 0 20 20"
      className={`w-6 h-6 ${filled ? "text-yellow-400" : "text-gray-300"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
    </svg>
  );

  // ⭐ 별 렌더 + 즉시 저장
  const saveRating = async (value: number) => {
    setRating(value);
    const user = getAuth().currentUser;
    if (!user || !cleanId) return;
    await setDoc(
      doc(db, "users", user.uid, "books", cleanId),
      { rating: value, updatedAt: new Date() },
      { merge: true }
    );
  };

  const renderStars = () => {
    const active = hoverRating || rating;
    return (
      <div className="flex items-center gap-1" role="radiogroup" aria-label="별점 선택">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => saveRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            role="radio"
            aria-checked={rating === n}
            title={`${n}점`}
            className="focus:outline-none"
          >
            <Star filled={n <= active} />
          </button>
        ))}
        <span className="ml-1 text-sm text-gray-500">{rating}/5</span>
      </div>
    );
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;
    if (!user || !cleanId) return;

    // delta 계산 → 미션 연동
    const delta = readPages - prevPages;
    if (delta > 0) {
      window.dispatchEvent(new CustomEvent("reading-progress", { detail: delta }));
      localStorage.setItem("pending-delta", delta.toString());
      setPrevPages(readPages);
    }

    const ref = doc(db, "users", user.uid, "books", cleanId);
    await updateDoc(ref, {
      summary,
      thoughts,
      readPages,
      totalPages,
      rating, // ⭐ 저장 버튼으로도 함께 저장
      updatedAt: new Date(),
    });

    alert("저장되었습니다!");
    window.dispatchEvent(new CustomEvent("reading-progress-sync"));
  };

  if (!book) return <div className="p-4 text-gray-500">로딩 중...</div>;

  const barData = {
    labels: [""],
    datasets: [
      { label: "읽은 페이지", data: [safeReadPages], backgroundColor: "#3b82f6", borderRadius: 6, barThickness: 20 },
      { label: "남은 페이지", data: [Math.max(totalPages - safeReadPages, 0)], backgroundColor: "#e5e7eb", borderRadius: 6, barThickness: 20 },
    ],
  };
  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { stacked: true, max: totalPages, beginAtZero: true, display: false }, y: { stacked: true, display: false } },
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-md rounded-xl space-y-6">
      {/* 상단 책 정보 */}
      <div className="flex gap-6 items-start">
        <div className="w-40 h-60 bg-gray-100 rounded overflow-hidden">
          <Image src={book.thumbnail || "/noimage.png"} alt={book.title} width={160} height={240} className="object-cover w-full h-full" />
        </div>
        <div className="flex-1 space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">{book.title}</h2>
          <p className="text-sm text-gray-500">{book.authors?.join(", ")}</p>
          <p className="text-xs text-gray-400">{book.publisher}</p>
        </div>
      </div>

      {/* 📖 진행률 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">📖 읽은 페이지</label>
        <div className="flex gap-2 items-center mb-2">
          <input type="number" value={readPages} onChange={(e) => setReadPages(Math.min(Number(e.target.value), totalPages))} className="border rounded px-3 py-1 w-24" />
          <span className="text-sm text-gray-500">/</span>
          <input type="number" value={totalPages} onChange={(e) => setTotalPages(Number(e.target.value))} className="border rounded px-3 py-1 w-24" />
          <span className="text-sm text-gray-500">페이지</span>
        </div>
        <div className="h-[30px] w-full">
          <Bar data={barData} options={barOptions} />
        </div>
        <p className="text-xs text-gray-500 text-right mt-1">{readPages}p / {totalPages}p</p>
      </div>

      {/* 감상평 + ⭐별점 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-semibold">📌 감상평</label>
          {renderStars()}
        </div>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full border rounded p-3 text-sm" rows={4} />
      </div>

      {/* 버튼 */}
      <div className="flex justify-between pt-4">
        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold">저장하기</button>
        <button onClick={() => window.history.back()} className="text-sm text-gray-500 underline">닫기</button>
      </div>
    </div>
  );
}
