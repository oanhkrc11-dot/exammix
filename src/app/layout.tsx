import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamMix Pro",
  description: "Hệ thống soạn đề, ngân hàng câu hỏi và chấm điểm cho giáo viên.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <head>
        <script
          // Dark is the default; only add .light if the user chose it.
          // Avoids a flash of the wrong theme before paint.
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('exammix_theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
