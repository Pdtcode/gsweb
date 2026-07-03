import {
  Fira_Code as FontMono,
  Inter as FontSans,
  BIZ_UDMincho as FontUDMincho,
  Dokdo as FontDokdo,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const fontUDMincho = FontUDMincho({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-udmincho",
});

export const fontDokdo = FontDokdo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dokdo",
});
