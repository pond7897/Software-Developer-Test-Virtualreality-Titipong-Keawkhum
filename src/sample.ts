import type { TicketQueueEntry } from "./queue";

// ข้อมูลตัวอย่าง 13 บัญชี: คอนเสิร์ตเริ่ม 20:00 (UTC+7) ของ 2026-11-03
// ใช้เป็นค่าเริ่มต้นของ store และเป็นข้อมูลในเทสต์
export const SAMPLE_NOW = "2026-11-03T19:00:00+07:00";
const at = (hhmm: string) => `2026-11-03T${hhmm}:00+07:00`;
const EVENT = at("20:00");

export const SAMPLE_ENTRIES: TicketQueueEntry[] = [
  { id: "e01", fanId: "f01", fanName: "Nok", ticketValue: 3500, joinedQueueAt: at("17:00"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 800, upgradesLast30Days: 0, membership: "vip", phoneNumber: "081-234-5678", deviceId: "D-100", paymentAccount: "PAY-11" },
  { id: "e02", fanId: "f02", fanName: "Nok (2nd account)", ticketValue: 3500, joinedQueueAt: at("17:05"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 800, upgradesLast30Days: 1, membership: "regular", phoneNumber: " 0812345678", deviceId: "D-200", paymentAccount: null },
  { id: "e03", fanId: "f03", fanName: "NokNok99", ticketValue: 3500, joinedQueueAt: at("17:10"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 600, upgradesLast30Days: 1, membership: "regular", phoneNumber: "099 111 2222", deviceId: "D-200", paymentAccount: "PAY-77" },
  { id: "e04", fanId: "f04", fanName: "Mint", ticketValue: 2800, joinedQueueAt: at("16:30"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 5000, upgradesLast30Days: 2, membership: "regular", phoneNumber: "089 555 1212", deviceId: "D-300", paymentAccount: null },
  { id: "e05", fanId: "f05", fanName: "Beam", ticketValue: 6000, joinedQueueAt: at("18:30"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 300, upgradesLast30Days: 0, membership: "vip", phoneNumber: "+66 89 555 1212", deviceId: "D-400", paymentAccount: null },
  { id: "e06", fanId: "f06", fanName: "Pim", ticketValue: 3000, joinedQueueAt: at("16:45"), eventStartsAt: EVENT, status: "cancelled", loyaltyPoints: 2000, upgradesLast30Days: 0, membership: "regular", phoneNumber: "082-000-1111", deviceId: "D-500", paymentAccount: null },
  { id: "e07", fanId: "f07", fanName: "Ton", ticketValue: 4000, joinedQueueAt: at("16:40"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 3000, upgradesLast30Days: 0, membership: "blocked", phoneNumber: "083-222-3333", deviceId: "D-600", paymentAccount: "PAY-99" },
  { id: "e08", fanId: "f08", fanName: "Fah", ticketValue: 0, joinedQueueAt: at("17:30"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 900, upgradesLast30Days: 0, membership: "regular", phoneNumber: "084-333-4444", deviceId: "D-700", paymentAccount: null },
  { id: "e09", fanId: "f09", fanName: "Joy", ticketValue: 3200, joinedQueueAt: at("16:50"), eventStartsAt: EVENT, status: "upgraded", loyaltyPoints: 1500, upgradesLast30Days: 3, membership: "regular", phoneNumber: "085-444-5555", deviceId: "D-800", paymentAccount: null },
  { id: "e10", fanId: "f10", fanName: "Dao", ticketValue: 2500, joinedQueueAt: at("18:00"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 100, upgradesLast30Days: 0, membership: "regular", phoneNumber: null, deviceId: "", paymentAccount: null },
  { id: "e11", fanId: "f11", fanName: "Ek", ticketValue: 2500, joinedQueueAt: at("18:05"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 100, upgradesLast30Days: 0, membership: "regular", phoneNumber: "", deviceId: "  ", paymentAccount: null },
  { id: "e12", fanId: "f12", fanName: "Ice", ticketValue: 3000, joinedQueueAt: at("17:20"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 1200, upgradesLast30Days: 0, membership: "regular", phoneNumber: "086-666-7777", deviceId: "D-900", paymentAccount: "pay-99" },
  { id: "e13", fanId: "f13", fanName: "Golf", ticketValue: "1,200", joinedQueueAt: at("16:00"), eventStartsAt: EVENT, status: "waiting", loyaltyPoints: 50, upgradesLast30Days: 0, membership: "regular", phoneNumber: "087-777-8888", deviceId: "D-950", paymentAccount: null },
];
