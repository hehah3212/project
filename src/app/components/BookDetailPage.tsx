"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
  const [prevPages, setPrevPages] = useState(0); // ✅ 추가

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
        const data = snap.data();
        setSummary(data.summary || "");
        setThoughts(data.thoughts || "");
        setReadPages(data.readPages || 0);
        setPrevPages(data.readPages || 0); // ✅ 저장 전 값 보관
        setTotalPages(data.totalPages || 320);
        setBook((prev: any) => prev || data);
      }
    });
    return () => unsubscribe();
  }, [cleanId]);

  const handleSave = async () => {
    const user = getAuth().currentUser;
    if (!user || !cleanId) return;

    // ✅ delta 계산 및 이벤트 전송
    const delta = readPages - prevPages;
    console.log("[DEBUG] dispatch delta:", delta);
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
      updatedAt: new Date(),
    });

    alert("저장되었습니다!");
    window.dispatchEvent(new CustomEvent("reading-progress-sync"));
  };

  if (!book) return <div className="p-4 text-gray-500">로딩 중...</div>;

  const barData = {
    labels: [""],
    datasets: [
      {
        label: "읽은 페이지",
        data: [safeReadPages],
        backgroundColor: "#3b82f6",
        borderRadius: 6,
        barThickness: 20,
      },
      {
        label: "남은 페이지",
        data: [Math.max(totalPages - safeReadPages, 0)],
        backgroundColor: "#e5e7eb",
        borderRadius: 6,
        barThickness: 20,
      },
    ],
  };

  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 0,
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        stacked: true,
        max: totalPages,
        beginAtZero: true,
        display: false,
      },
      y: {
        stacked: true,
        display: false,
      },
    },
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white shadow-md rounded-xl space-y-6">
      {/* 상단 책 정보 */}
      <div className="flex gap-6 items-start">
        <div className="w-40 h-60 bg-gray-100 rounded overflow-hidden">
          <Image
            src={book.thumbnail || "/noimage.png"}
            alt={book.title}
            width={160}
            height={240}
            className="object-cover w-full h-full"
          />
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
          <input
            type="number"
            value={readPages}
            onChange={(e) => setReadPages(Math.min(Number(e.target.value), totalPages))}
            className="border rounded px-3 py-1 w-24"
          />
          <span className="text-sm text-gray-500">/</span>
          <input
            type="number"
            value={totalPages}
            onChange={(e) => setTotalPages(Number(e.target.value))}
            className="border rounded px-3 py-1 w-24"
          />
          <span className="text-sm text-gray-500">페이지</span>
        </div>
        <div className="h-[30px] w-full">
          <Bar data={barData} options={barOptions} />
        </div>
        <p className="text-xs text-gray-500 text-right mt-1">
          {readPages}p / {totalPages}p
        </p>
      </div>

      {/* 감상평 */}
      <div>
        <label className="block text-sm font-semibold mb-1">📌 감상평</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full border rounded p-3 text-sm"
          rows={4}
        />
      </div>

      {/* 느낀점 */}
      <div>
        <label className="block text-sm font-semibold mb-1">💡 느낀점</label>
        <textarea
          value={thoughts}
          onChange={(e) => setThoughts(e.target.value)}
          className="w-full border rounded p-3 text-sm"
          rows={4}
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-between pt-4">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-semibold"
        >
          저장하기
        </button>
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-500 underline"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
