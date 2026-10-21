/**
 * Settings ▸ General ▸ Language. The nano ships with dozens of languages;
 * we translate the system UI into Thai (and fall back to English).
 */
import { useSettings } from '../../../core/settings/store';

export const LANGUAGES = ['English', 'ไทย', '日本語', '简体中文', '한국어', 'Français', 'Deutsch', 'Español', 'Italiano', 'Nederlands'];

const TH: Record<string, string> = {
  Music: 'เพลง',
  Videos: 'วิดีโอ',
  Fitness: 'ฟิตเนส',
  Podcasts: 'พ็อดคาสท์',
  Photos: 'รูปภาพ',
  Radio: 'วิทยุ',
  Settings: 'การตั้งค่า',
  Clock: 'นาฬิกา',
  Audiobooks: 'หนังสือเสียง',
  'Voice Memos': 'บันทึกเสียง',
  Playlists: 'เพลย์ลิสต์',
  Artists: 'ศิลปิน',
  Albums: 'อัลบั้ม',
  Songs: 'เพลง',
  Genres: 'ประเภท',
  Composers: 'ผู้แต่งเพลง',
  Compilations: 'รวมเพลง',
  Shuffle: 'สุ่ม',
  'Now Playing': 'กำลังเล่น',
  Back: 'กลับ',
  General: 'ทั่วไป',
  About: 'เกี่ยวกับ',
  'Date & Time': 'วันที่และเวลา',
  Wallpaper: 'ภาพพื้นหลัง',
  Brightness: 'ความสว่าง',
  Language: 'ภาษา',
  Bluetooth: 'บลูทูธ',
  Reset: 'รีเซ็ต',
  'Sound Check': 'ตรวจสอบเสียง',
  'Volume Limit': 'จำกัดระดับเสียง',
  'Group Compilations': 'จัดกลุ่มรวมเพลง',
  Walk: 'เดิน',
  Run: 'วิ่ง',
  History: 'ประวัติ',
  Stopwatch: 'นาฬิกาจับเวลา',
  Timer: 'ตัวตั้งเวลา',
  Movies: 'ภาพยนตร์',
  'Music Videos': 'มิวสิควิดีโอ',
  'TV Shows': 'รายการทีวี',
  'slide to unlock': 'เลื่อนเพื่อปลดล็อค',
  Edit: 'แก้ไข',
  Done: 'เสร็จสิ้น',
  Cancel: 'ยกเลิก',
  'All Photos': 'รูปภาพทั้งหมด',
  Favorites: 'รายการโปรด',
  'Local Stations': 'สถานีท้องถิ่น',
  'Recent Songs': 'เพลงล่าสุด',
  Snooze: 'เลื่อนปลุก',
  Alarm: 'การปลุก',
  Start: 'เริ่ม',
  Stop: 'หยุด',
  Lap: 'รอบ',
  Pause: 'หยุดชั่วคราว',
  Resume: 'ทำต่อ',
  Videos_: 'วิดีโอ',
};

let lang = useSettings.getState().language;
useSettings.subscribe((s) => {
  lang = s.language;
});

/** Translate a system string (English is the key). */
export function t(s: string): string {
  if (lang === 'ไทย') return TH[s] ?? s;
  return s;
}
