"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Book } from "./BookSearch";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type BookCardProps = {
  book: Book;
  onDelete?: (isbn: string) => void;
  onReadIncrease?: (delta: number) => void;
  onClick?: () => void;
};

export default function BookCard({ book, onDelete, onReadIncrease, onClick }: BookCardProps) {
  const [totalPages, setTotalPages] = useState<number>(320);
  const [readPages, setReadPages] = useState<number>(0);
  const [prevPages, setPrevPages] = useState<number>(0); // ✅ 추가
  const [summary, setSummary] = useState<string>("");
  const router = useRouter();

  const safeReadPages = Math.min(readPages, totalPages);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, "users", user.uid, "books", book.isbn);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setTotalPages(data.totalPages || 320);
          setReadPages(data.readPages || 0);
          setPrevPages(data.readPages || 0); // ✅ 이전 페이지 수 저장
          setSummary(data.summary || "");
        }
      }
    });
    return () => unsubscribe();
  }, [book]);

  const handleSave = async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    const delta = readPages - prevPages;
    if (delta > 0 && onReadIncrease) {
      onReadIncrease(delta); // ✅ 콜백 호출
      setPrevPages(readPages); // ✅ 상태 동기화
    }

    const ref = doc(db, "users", user.uid, "books", book.isbn);
    await setDoc(
      ref,
      {
        totalPages,
        readPages,
        summary,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    alert("저장되었습니다!");
    window.dispatchEvent(new CustomEvent("reading-progress-sync"));
  };

  // 차트 데이터
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
    <div className="relative bg-white p-6 rounded-2xl shadow-lg space-y-6 w-[320px] min-w-[300px]">
      {onDelete && (
        <button
          onClick={() => {
            const confirmDelete = confirm("정말 이 책을 삭제하시겠습니까?");
            if (confirmDelete) onDelete(book.isbn);
          }}
          className="absolute top-3 right-3 text-sm text-red-500 hover:text-red-700"
        >
          ✕
        </button>
      )}

      <div className="flex gap-4">
        <div className="w-24 h-36 bg-gray-200 rounded overflow-hidden flex-shrink-0">
          {book.thumbnail ? (
            <Image
              src={book.thumbnail}
              alt={book.title}
              width={96}
              height={144}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-500">
              책 이미지
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-bold text-gray-800 line-clamp-2">{book.title}</h2>
          <p className="text-sm text-gray-500">{book.authors.join(", ")}</p>
          <p className="text-xs text-gray-400">{book.publisher}</p>
          <p className="text-xs text-gray-400">총 {totalPages} 페이지</p>
        </div>
      </div>


      <div>
        <p className="text-sm font-semibold mb-1">📖 진행률</p>
        <div className="h-[30px] w-full">
          <Bar data={barData} options={barOptions} />
        </div>
        <p className="text-xs text-gray-500 text-right mt-1">
          {readPages}p / {totalPages}p
        </p>
      </div>

      {onClick ? (
        // “추가” 전용 버튼
        <div className="pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-semibold"
          >
            추가하기
          </button>
        </div>
      ) : (
        <div className="pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/books/${book.isbn}`); }}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
          >
            독후활동 하러가기
          </button>
        </div>
      )}
    </div>

  );
}
