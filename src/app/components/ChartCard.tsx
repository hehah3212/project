"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ChartCard() {
  const data = {
    labels: ["1월", "2월", "3월"],
    datasets: [
      {
        data: [10, 20, 30],
        backgroundColor: ["#facc15", "#fde68a", "#fef3c7"],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-start justify-start space-y-4">
      <h2 className="text-lg font-bold text-gray-800">📊 올해 독서량</h2>
      <div className="w-full flex justify-center items-center">
        <div className="w-48 h-48">
          <Doughnut data={data} />
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center w-full">월별 독서 비율을 확인하세요</p>
    </div>
  );
}