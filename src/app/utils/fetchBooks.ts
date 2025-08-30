// src/app/utils/fetchBooks.ts
import type { Book } from "../components/BookSearch";

const KAKAO_API = "https://dapi.kakao.com/v3/search/book";
const HEADER = {
  Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}`,
};

/**
 * 제목(query)으로 책 검색
 */
export async function fetchBooks(query: string): Promise<Book[]> {
  const res = await fetch(
    `${KAKAO_API}?target=title&query=${encodeURIComponent(query)}`,
    { headers: HEADER }
  );
  if (!res.ok) {
    throw new Error("책 정보를 가져오지 못했습니다.");
  }
  const data = await res.json();
  return data.documents.map((d: any) => ({
    title: d.title,
    authors: d.authors,
    thumbnail: d.thumbnail,
    publisher: d.publisher,
    contents: d.contents,
    // ISBN 문자열이 "9781234567890 1234567890123" 처럼 들어오므로
    // 공백으로 분리한 첫 번째 값만 사용
    isbn: d.isbn.split(" ")[0],
  }));
}

/**
 * ISBN 배열로 책 정보 조회
 */
export async function fetchBooksByISBN(isbns: string[]): Promise<Book[]> {
  const results: Book[] = [];
  for (const isbn of isbns) {
    const res = await fetch(
      `${KAKAO_API}?target=isbn&query=${encodeURIComponent(isbn)}`,
      { headers: HEADER }
    );
    if (!res.ok) continue;
    const data = await res.json();
    if (data.documents.length > 0) {
      const d = data.documents[0];
      results.push({
        title: d.title,
        authors: d.authors,
        thumbnail: d.thumbnail,
        publisher: d.publisher,
        contents: d.contents,
        isbn: isbn, // 이미 깨끗한 ISBN
      });
    }
  }
  return results;
}