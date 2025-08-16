"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "./components/BookSearch";
import BookSearch from "./components/BookSearch";
import BookCard from "./components/BookCard";
import ChartCard from "./components/ChartCard";
import ProgressBar from "./components/ProgressBar";
import Header from "./components/Header";
import RankingCard from "./components/RankingCard";
import MyPage from "./components/MyPage";
import ReadingMissionList from "./components/ReadingMissionList";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, updateDoc, deleteDoc, setDoc,
  getDocs, collection
} from "firebase/firestore";
import { db } from "./utils/firebase";

export default function Home() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false); // ✅ 추가
  const [bookList, setBookList] = useState<Book[]>([]);
  const [view, setView] = useState<"main" | "mypage">("main");
  const [showSearch, setShowSearch] = useState(false);

  const bookKey = (id?: string | null) => (id ? `book-list:${id}` : "book-list");

  // 🔐 인증 상태 관찰 (localStorage 의존 제거)
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUid(u?.uid ?? null);
      setAuthReady(true);              // ✅ 최초 응답 후에만 가드 동작
    });
    return () => unsub();
  }, []);

  // ❗ authReady 후에만 /login 리다이렉트 → 루프 방지
  useEffect(() => {
    if (!authReady) return;
    if (!uid) router.replace("/login");
  }, [authReady, uid, router]);

  // 📥 UID 정해지면 Firestore ➜ 로컬 캐시 순으로 로드
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users", uid, "books"));
        if (!snap.empty) {
          const fromFs: Book[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              isbn: data.isbn || d.id,
              title: data.title,
              authors: data.authors || (data.author ? [data.author] : []),
              thumbnail: data.thumbnail,
              publisher: data.publisher,
            } as Book;
          });
          setBookList(fromFs);
          localStorage.setItem(bookKey(uid), JSON.stringify(fromFs));
          localStorage.removeItem("book-list"); // 레거시 정리
          return;
        }
      } catch (e) {
        console.warn("Firestore 로드 실패, 로컬 캐시 사용", e);
      }
      try {
        const cached = localStorage.getItem(bookKey(uid)) || localStorage.getItem("book-list");
        setBookList(cached ? JSON.parse(cached) : []);
        localStorage.removeItem("book-list");
      } catch {
        setBookList([]);
      }
    })();
  }, [uid]);

  // ✅ 책 추가
  const handleBookSelect = async (book: Book) => {
    const currentUid = uid || getAuth().currentUser?.uid;
    if (!currentUid) {
      alert("로그인 상태를 확인해주세요.");
      return;
    }
    const isbn = book.isbn.split(" ")[0];
    const cleaned: Book = { ...book, isbn };

    setBookList((prev) => {
      if (prev.some((b) => b.isbn === isbn)) return prev;
      const updated = [...prev, cleaned];
      localStorage.setItem(bookKey(currentUid), JSON.stringify(updated));
      return updated;
    });

    await setDoc(
      doc(db, "users", currentUid, "books", isbn),
      {
        ...cleaned,
        readPages: 0,
        totalPages: 320,
        summary: "",
        thoughts: "",
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    setShowSearch(false);
  };

  const handleReadingIncrease = (delta: number) => {
    window.dispatchEvent(new CustomEvent("reading-progress", { detail: delta }));
  };

  // ✅ 책 삭제
  const handleDeleteBook = async (isbn: string) => {
    if (!uid) return;
    const updated = bookList.filter((b) => b.isbn !== isbn);
    setBookList(updated);
    localStorage.setItem(bookKey(uid), JSON.stringify(updated));

    localStorage.removeItem(`reading-${isbn}`);
    localStorage.removeItem(`reading:${uid}:${isbn}`);

    try {
      await deleteDoc(doc(db, "users", uid, "books", isbn));
    } catch (err: any) {
      alert("Firestore 삭제 실패: " + err.message);
    }
  };

  // 미션 리워드 → 포인트 증가
  const handleMissionReward = async (reward: number) => {
    const currentUid = uid || getAuth().currentUser?.uid;
    if (!currentUid) return;
    const ref = doc(db, "users", currentUid);
    const snap = await getDoc(ref);
    const cur = snap.exists() ? (snap.data() as any).point || 0 : 0;
    await updateDoc(ref, { point: cur + reward });
  };

  // 인증 확정 전엔 빈 화면로딩 방지
  if (!authReady) {
    return (
      <main className="bg-gray-50 min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 pt-10 text-gray-400">인증 확인 중…</div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen">
      <Header />

      <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6 pb-10 space-y-8">
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setView("main")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
              view === "main"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            홈
          </button>
          <button
            onClick={() => setView("mypage")}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
              view === "mypage"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            내 정보
          </button>
        </div>

        {view === "main" && (
          <>
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800">독서 통계</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ChartCard />
                <div className="bg-white p-6 rounded-2xl shadow space-y-4">
                  <h3 className="text-base font-semibold text-gray-700">📈 오늘의 목표</h3>
                  <ProgressBar value={50} label="독서 완료 횟수" />
                  <ProgressBar value={30} label="개인 미션 완수량" />
                </div>
                <div className="bg-white p-6 rounded-2xl shadow space-y-4">
                  <RankingCard />
                </div>
              </div>
            </section>

            <section className="mt-12">
              <div className="bg-white p-6 rounded-2xl shadow">
                <ReadingMissionList
                  showForm={false}
                  onlyActive={true}
                  onReward={handleMissionReward}
                />
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-inner mt-12">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  📘 추가된 책: {bookList.length}권
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push("/favorites")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full transition"
                  >
                    즐겨찾기 보기
                  </button>
                  <button
                    onClick={() => setShowSearch((prev) => !prev)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-white px-4 py-2 rounded-full"
                  >
                    책 추가
                  </button>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto">
                {bookList.length === 0 ? (
                  <div className="text-gray-400 text-center w-full">
                    📚 책을 추가하고 독서를 시작해보세요!
                  </div>
                ) : (
                  bookList.map((book) => (
                    <BookCard
                      key={book.isbn}
                      book={book}
                      onDelete={handleDeleteBook}
                      onReadIncrease={handleReadingIncrease}
                    />
                  ))
                )}
              </div>
            </section>

            {showSearch && (
              <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl bg-white px-10 py-6 shadow-lg border-b z-50 rounded-b-xl">
                <div className="flex justify-between items-center mb-5">
                  <h4 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
                    📖 책 검색
                  </h4>
                  <button
                    className="text-sm text-gray-400 hover:text-black"
                    onClick={() => setShowSearch(false)}
                  >
                    ✕ 닫기
                  </button>
                </div>
                <BookSearch onBookSelect={handleBookSelect} />
              </div>
            )}
          </>
        )}

        {view === "mypage" && <MyPage />}
      </div>
    </main>
  );
}
