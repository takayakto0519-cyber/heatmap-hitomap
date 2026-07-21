// クライアント・サーバー両方から安全にimportできる、日程調整まわりの純粋な定数。
// lib/googleCalendarServer.ts はOAuth環境変数を扱うためサーバー専用（'use client'から
// importしてはいけない）だが、このMeet URLだけは確認画面（クライアント）でも必要なので
// ここに切り出し、双方から参照する。

// 日程調整サイト（/schedule）経由の打ち合わせで使う固定のGoogle MeetURL。
// 会長の指示で全件このURLに統一する（Google Calendar側の自動発行conferenceDataは使わない）。
export const SCHEDULING_MEET_URL = 'https://meet.google.com/kbk-hhwi-pzc';
