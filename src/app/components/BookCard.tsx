"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Book } from "./BookSearch";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Heart } from "lucide-react";
import { db } from "../utils/firebase";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type BookCardProps = {
  book: Book;
  onDelete?: (isbn: string) => void;
  onReadIncrease?: (delta: number) => void;
  onClick?: () => void;
  onUnfavorite?: (isbn: string) => void;
};

export default function BookCard({
  book,
  onDelete,
  onReadIncrease,
  onClick,
  onUnfavorite,
}: BookCardProps) {
  const [totalPages, setTotalPages] = useState<number>(320);
  const [readPages, setReadPages] = useState<number>(0);
  const [prevPages, setPrevPages] = useState<number>(0);
  const [summary, setSummary] = useState<string>("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);

  // ⭐ 공개 감상평 평균/개수
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const hasReviews = useMemo(() => (reviewCount ?? 0) > 0, [reviewCount]);

  const router = useRouter();
  const safeReadPages = Math.min(readPages, totalPages);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      setUserUid(user.uid);

      // 내 책 진행/요약 불러오기
      const bookRef = doc(db, "users", user.uid, "books", book.isbn);
      const snap = await getDoc(bookRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        setTotalPages(data.totalPages || 320);
        setReadPages(data.readPages || 0);
        setPrevPages(data.readPages || 0);
        setSummary(data.summary || "");
      }

      // 즐겨찾기 여부
      const favRef = doc(db, "users", user.uid, "favorites", book.isbn);
      const favSnap = await getDoc(favRef);
      setIsFavorite(favSnap.exists());
    });

    return () => unsub();
  }, [book]);

  // 공개 감상평 평균 별점 불러오기 (books/{isbn}/reviews)
  useEffect(() => {
    (async () => {
      try {
        const ref = collection(db, "books", book.isbn, "reviews");
        const snap = await getDocs(ref);
        if (snap.empty) {
          setAvgRating(null);
          setReviewCount(0);
          return;
        }
        let total = 0;
        let cnt = 0;
        snap.docs.forEach((d) => {
          const r = d.data()?.rating;
          if (typeof r === "number" && r > 0) {
            total += r;
            cnt += 1;
          }
        });
        setReviewCount(cnt);
        setAvgRating(cnt > 0 ? total / cnt : null);
      } catch {
        setAvgRating(null);
        setReviewCount(0);
      }
    })();
  }, [book.isbn]);

  const toggleFavorite = async () => {
    if (!userUid) return;
    const ref = doc(db, "users", userUid, "favorites", book.isbn);

    if (isFavorite) {
      const confirmDelete = confirm("즐겨찾기 목록에서 제거하시겠습니까?");
      if (!confirmDelete) return;

      await deleteDoc(ref);
      setIsFavorite(false);
      onUnfavorite?.(book.isbn);
    } else {
      await setDoc(ref, {
        ...book,
        addedAt: new Date().toISOString(),
      });
      setIsFavorite(true);
    }
  };

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
    layout: { padding: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { stacked: true, max: totalPages, beginAtZero: true, display: false },
      y: { stacked: true, display: false },
    },
  };

  // ⭐ 읽기 전용 별(평균 시각화)
  const Star = ({ filled }: { filled: boolean }) => (
    <svg
      viewBox="0 0 20 20"
      className={`w-5 h-5 ${filled ? "text-yellow-400" : "text-gray-300"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
    </svg>
  );

  const renderAvgStars = () => {
    const value = avgRating ?? 0;
    const full = Math.round(value); // 간단히 반올림하여 채우기
    return (
      <div className="flex items-center gap-1" aria-label="평균 별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= full} />
        ))}
        {hasReviews ? (
          <span className="ml-1 text-xs text-gray-600">
            {value.toFixed(1)} ({reviewCount})
          </span>
        ) : (
          <span className="ml-1 text-xs text-gray-400">감상평이 없습니다</span>
        )}
      </div>
    );
  };

  const handleSave = async () => {
    const user = getAuth().currentUser;
    if (!user) return;

    const delta = readPages - prevPages;
    if (delta > 0 && onReadIncrease) {
      onReadIncrease(delta);
      setPrevPages(readPages); // ✅ 저장 시에만 delta 반영
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
          <h2 className="text-lg font-bold text-gray-800 line-clamp-2">
            {book.title}
          </h2>
          <p className="text-sm text-gray-500">{book.authors.join(", ")}</p>
          <p className="text-xs text-gray-400">{book.publisher}</p>
          <p className="text-xs text-gray-400">총 {totalPages} 페이지</p>

          {/* ⭐ 평균 별점 (읽기 전용) */}
          {renderAvgStars()}

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite();
            }}
            aria-label="즐겨찾기 토글"
            className="mt-1"
          >
            <Heart
              className={`w-5 h-5 transition ${
                isFavorite ? "text-red-500 fill-red-500" : "text-gray-300"
              }`}
            />
          </button>
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
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/books/${book.isbn}`);
            }}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
          >
            독후활동 하러가기
          </button>
        </div>
      )}
    </div>
  );
}
