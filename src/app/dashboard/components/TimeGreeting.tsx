'use client';

import { useEffect, useState } from 'react';

const QUOTES_BY_TIME = {
  morning: [
    'Pagi! Kopi udah aman? Mari taklukkan dunia hari ini! ☕✨',
    'Semangat pagi! Draf revisi kemaren jangan lupa dicek ya~ 🌅',
    'Masih pagi, otak masih seger. Waktunya ngebut kreasinya! 🚀',
    'Pagi gaes! Nyalakan kreativitas, matikan rasa malas. 🔥',
    'Selamat pagi! Semoga hari kamu dipenuhi ide-ide brilian ✨',
    'Buka laptop, hirup napas dalam-dalam, mari berkarya! 💻☀️',
    'Pagi-pagi gini racikan desain pasti makin ciamik nih 🎨✨',
    'Awali hari dengan senyuman dan segelas semangat! 😄☕',
    'Pagi! Fokus satu per satu task, jangan lupa napas ya~ 🌿',
    'Semangat! Hari baru, peluang baru buat bikin karya keren 🌟',
  ],
  afternoon: [
    'Siang! Udah makan siang belum? Otak butuh asupan lho 🍱😄',
    'Jangan lupa minum air putih, biar ide tetep mengalir deras 💧✨',
    'Mata udah merem melek? Tarik nafas, stretch dikit yuk! 🧘‍♂️',
    'Jam-jam rawan ngantuk nih, yok fokus sedikit lagi! 💪',
    'Siang gaes! Istirahat sejenak biar pikiran tegar lagi 🍔☕',
    'Udah jam siang nih, jangan lupa ngemil biar mood tetep bagus 🍪',
    'Revisi dikit bukan halangan, tetap semangat meluncur! 🚀',
    'Siang hari waktunya eksekusi ide-ide seru yang tadi pagi disusun ⚡',
    'Cas energi dulu yuk! 15 menit selonjoran bakal bantu banget 🔋',
    'Setengah hari udah dilewati dengan keren, lanjut terus! 🎯',
  ],
  evening: [
    'Sore gaes! Dikit lagi jam pulang / beres-beres nih 🌇🙌',
    'Tetap tenang, kerjaan hari ini udah mantap banget! 🏆',
    'Sore-sore gini enaknya ngopi sambil rekap progress hari ini ☕',
    'Hampir beres! Evaluasi singkat lalu istirahat yang cukup 🌙',
    'Matahari mulai tenggelam, kerjaan mulai kicep nih mantap 🌅',
    'Sore! Rapikan file & draf biar besok pagi gak pusing 📁✨',
    'Makasih buat kerja kerasmu hari ini, kamu luar biasa! 🎉',
    'Sore cerah, ide tetap membara. Dikit lagi tuntas kok! ⚡',
    'Waktunya cooling down pikiran setelah seharian beraksi 🍵',
    'Sore gaes! Jangan lupa pencet Simpan / Commit sebelum tutup 💾',
  ],
  night: [
    'Udah malam nih, masih lembur aja? Jaga kesehatan ya 🌙✨',
    'Jangan lupa tidur gaes, ide jenius butuh otak yang istirahat 💤',
    'Mode nimbun ide malam hari activated! Tetap semangat 🦉',
    'Hebat banget hari ini! Jangan lupa simpan karya kamu & rehat 🛋️',
    'Sunyi malam emang paling pas buat ngulik desain, tapi inget istirahat ya 🌌',
    'Night owl mode: ON 🦉 Tapi baterai tubuh tetap perlu dicas lho 🔋',
    'Jangan lupa matikan lampu kerja kalau udah kelar, tidur yang nyenyak 🛌',
    'Draf malam ini kece badai! Besok tinggal dipoles dikit 💎',
    'Sudahi lemburmu, mari rebahan bersama kasur tercinta 😴',
    'Malam gaes! Mimpi indah dan selamat beristirahat 🌟',
  ],
};

export default function TimeGreeting() {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    let category: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';

    if (hour >= 5 && hour < 11) {
      category = 'morning';
    } else if (hour >= 11 && hour < 15) {
      category = 'afternoon';
    } else if (hour >= 15 && hour < 18) {
      category = 'evening';
    } else {
      category = 'night';
    }

    const quotes = QUOTES_BY_TIME[category];
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setGreeting(quotes[randomIndex]);
  }, []);

  if (!greeting) return null;

  return (
    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-2 animate-in fade-in duration-300">
      <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
      <span className="italic truncate max-w-md">{greeting}</span>
    </div>
  );
}
