// ========== HERIKEYZENLOCKER BOT - FULL VERSION ==========
// File: index.js
// Letak: /Panel-bot/index.js
// Developer: HeriKeyzenlocker
// Version: 8.0.0 - LENGKAP! PANEL + DANA + NGAJI + ADMIN + PREMIUM + LOGS + BAN + BROADCAST
// Copyright © 2026

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const axios = require('axios');

// ========== KONFIGURASI ==========
const CONFIG = require('./config.js');

// ========== SETUP BOT ==========
const bot = new Telegraf(process.env.BOT_TOKEN || CONFIG.BOT_TOKEN);
let db;

// ========== PATH GAMBAR ==========
const IMAGES_PATH = path.join(__dirname, 'PanelAnim', 'images');
const DB_FILE = path.join(__dirname, 'database.sqlite');
const LOGS_PATH = path.join(__dirname, 'logs');

// ========== FUNGSI GAMBAR ==========
function getImagePath(imageName) {
    return path.join(IMAGES_PATH, imageName);
}

async function sendWithImage(ctx, imageName, text, keyboard = null) {
    try {
        const imagePath = getImagePath(imageName);
        if (fs.existsSync(imagePath)) {
            await ctx.replyWithPhoto(
                { source: imagePath },
                {
                    caption: text,
                    parse_mode: 'Markdown',
                    ...(keyboard && { reply_markup: keyboard })
                }
            );
        } else {
            await ctx.reply(text, {
                parse_mode: 'Markdown',
                ...(keyboard && { reply_markup: keyboard })
            });
            console.log(`⚠️ Gambar ${imageName} tidak ditemukan di ${imagePath}`);
        }
    } catch (err) {
        console.log('Error send image:', err.message);
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            ...(keyboard && { reply_markup: keyboard })
        });
    }
}

async function editWithImage(ctx, imageName, text, keyboard = null) {
    try {
        await ctx.deleteMessage();
        await sendWithImage(ctx, imageName, text, keyboard);
    } catch (err) {
        console.log('Error edit message:', err.message);
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            ...(keyboard && { reply_markup: keyboard })
        });
    }
}

// ========== FUNGSI FORMAT RUPIAH ==========
function formatRupiah(amount) {
    return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ========== FUNGSI GENERATE ID & PASSWORD ==========
function generateId() {
    return 'INV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex');
}

function generatePass() {
    return crypto.randomBytes(4).toString('hex');
}

// ========== FUNGSI DANA TEXT ==========
function getDanaText() {
    let text = '📞 *NOMOR DANA PENERIMA:*\n\n';
    CONFIG.DANA_NUMBERS.forEach(item => {
        text += `${item.label}: \`${item.number}\`\n`;
    });
    return text;
}

// ========== FUNGSI CEK ADMIN ==========
function isAdmin(userId) {
    return userId === parseInt(process.env.ADMIN_ID || CONFIG.ADMIN_ID);
}

function isOwner(userId) {
    return userId === parseInt(process.env.OWNER_ID || CONFIG.OWNER_ID || CONFIG.ADMIN_ID);
}

// ========== FUNGSI CEK ROLE USER ==========
async function getUserRole(userId) {
    const user = await db.get('SELECT role, premium_until FROM users WHERE user_id = ?', userId);
    if (!user) return 'user';
    
    // Cek premium expired
    if (user.role === 'premium' && user.premium_until) {
        if (moment().isAfter(moment(user.premium_until))) {
            await db.run('UPDATE users SET role = "user" WHERE user_id = ?', userId);
            return 'user';
        }
    }
    
    return user.role || 'user';
}

async function isPremium(userId) {
    const role = await getUserRole(userId);
    return role === 'premium' || role === 'admin' || role === 'owner';
}

// ========== FUNGSI CREDITS DINAMIS ==========
async function getCredits(userId) {
    let role = await getUserRole(userId);
    if (isOwner(userId)) role = 'owner';
    else if (isAdmin(userId)) role = 'admin';
    
    const roleEmoji = {
        owner: '👑',
        admin: '⚙️',
        premium: '💎',
        user: '👤'
    };
    
    const roleNames = {
        owner: 'OWNER',
        admin: 'ADMIN',
        premium: 'PREMIUM',
        user: 'USER'
    };
    
    return {
        line1: '━━━━━━━━━━━━━━━━━━━━',
        line2: `${roleEmoji[role] || '👤'} *ROLE:* ${roleNames[role] || 'USER'}`,
        line3: '👨‍💻 *DEVELOPER:* HeriKeyzenlocker',
        line4: `📦 *Versi:* 8.0.0`,
        line5: '━━━━━━━━━━━━━━━━━━━━'
    };
}

async function addCredits(text, userId, position = 'bottom') {
    const credits = await getCredits(userId);
    const creditsText = `\n\n${credits.line1}\n${credits.line2}\n${credits.line3}\n${credits.line4}\n${credits.line5}`;
    
    if (position === 'top') {
        return creditsText + '\n\n' + text;
    } else {
        return text + creditsText;
    }
}

// ========== FUNGSI LOGGING ==========
async function addLog(userId, action, details = '') {
    try {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, `${moment().format('YYYY-MM-DD')}.log`);
        const logEntry = `[${moment().format('HH:mm:ss')}] User: ${userId} | Action: ${action} | Details: ${details}\n`;
        
        fs.appendFileSync(logFile, logEntry);
    } catch (err) {
        console.log('Log error:', err.message);
    }
}

// ========== FUNGSI NGAJI ==========
async function getRandomAyat() {
    try {
        const surahList = CONFIG.SURAH_LIST || [
            { number: 36, name: 'Yasin' },
            { number: 55, name: 'Ar-Rahman' },
            { number: 67, name: 'Al-Mulk' },
            { number: 112, name: 'Al-Ikhlas' }
        ];
        
        const randomSurah = surahList[Math.floor(Math.random() * surahList.length)];
        const response = await axios.get(`https://api.alquran.cloud/v1/surah/${randomSurah.number}`);
        
        if (response.data && response.data.data) {
            const surah = response.data.data;
            const randomAyat = Math.floor(Math.random() * surah.ayahs.length);
            const ayat = surah.ayahs[randomAyat];
            
            return {
                success: true,
                surah: surah.englishName,
                arab: surah.name,
                ayatNumber: ayat.number,
                text: ayat.text
            };
        }
        return { success: false };
    } catch (error) {
        console.log('Error ngaji:', error.message);
        return { success: false };
    }
}

// ========== SETUP DATABASE LENGKAP ==========
async function setupDB() {
    // Buat folder yang diperlukan
    const dirs = [IMAGES_PATH, path.join(__dirname, 'logs'), path.join(__dirname, 'proofs')];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Folder dibuat: ${dir}`);
        }
    });
    
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });
    
    await db.exec(`
        -- TABEL USERS (LENGKAP)
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            name TEXT,
            username TEXT,
            balance INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user',
            premium_until TEXT,
            total_order INTEGER DEFAULT 0,
            total_topup INTEGER DEFAULT 0,
            joined_at TEXT,
            last_seen TEXT,
            is_banned INTEGER DEFAULT 0,
            ban_reason TEXT,
            notes TEXT
        );
        
        -- TABEL PROOFS (BUKTI TRANSFER)
        CREATE TABLE IF NOT EXISTS proofs (
            proof_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            dana_number TEXT,
            dana_label TEXT,
            file_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            verified_at TEXT,
            verified_by INTEGER
        );
        
        -- TABEL ORDERS (PESANAN)
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            user_id INTEGER,
            product_id TEXT,
            product_name TEXT,
            price INTEGER,
            password TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            activated_at TEXT,
            expired_at TEXT,
            notes TEXT
        );
        
        -- TABEL PREMIUM CODES
        CREATE TABLE IF NOT EXISTS premium_codes (
            code_id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            duration INTEGER,
            role TEXT DEFAULT 'premium',
            created_by INTEGER,
            used_by INTEGER,
            used_at TEXT,
            created_at TEXT
        );
        
        -- TABEL LOGS
        CREATE TABLE IF NOT EXISTS logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            details TEXT,
            ip TEXT,
            created_at TEXT
        );
        
        -- TABEL BROADCASTS
        CREATE TABLE IF NOT EXISTS broadcasts (
            broadcast_id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT,
            total_sent INTEGER,
            total_failed INTEGER,
            created_by INTEGER,
            created_at TEXT
        );
        
        -- TABEL SETTINGS
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT,
            updated_by INTEGER
        );
    `);
    
    // Tambah owner otomatis
    const adminId = parseInt(process.env.ADMIN_ID || CONFIG.ADMIN_ID);
    await db.run(
        `INSERT OR IGNORE INTO users (user_id, name, role, joined_at) VALUES (?, 'Owner', 'owner', ?)`,
        adminId, moment().format()
    );
    
    // Tambah settings default
    await db.run(
        `INSERT OR IGNORE INTO settings (key, value) VALUES 
         ('bot_name', 'HERIKEYZENLOCKER BOT'),
         ('maintenance', 'false'),
         ('welcome_message', 'Selamat datang di bot kami')`
    );
    
    console.log('✅ Database siap dengan semua tabel');
}

// ========== MIDDLEWARE ==========
bot.use(async (ctx, next) => {
    if (ctx.from) {
        const now = moment().format();
        const userId = ctx.from.id;
        
        // CEK MAINTENANCE MODE
        const maintenance = await db.get('SELECT value FROM settings WHERE key = "maintenance"');
        if (maintenance?.value === 'true' && !isAdmin(userId)) {
            await ctx.reply('🔧 *BOT SEDANG MAINTENANCE*\n\nSilakan tunggu beberapa saat lagi.', {
                parse_mode: 'Markdown'
            });
            return;
        }
        
        // CEK BANNED
        const user = await db.get('SELECT is_banned, ban_reason FROM users WHERE user_id = ?', userId);
        if (user?.is_banned === 1) {
            await ctx.reply(
                `⛔ *AKSES DITOLAK*\n\n` +
                `Anda telah diblokir oleh admin.\n` +
                `Alasan: ${user.ban_reason || 'Tidak ada alasan'}\n\n` +
                `Hubungi owner untuk informasi lebih lanjut.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        // INSERT OR UPDATE USER
        await db.run(
            `INSERT OR IGNORE INTO users (user_id, name, username, joined_at, last_seen) 
             VALUES (?, ?, ?, ?, ?)`,
            userId, ctx.from.first_name, ctx.from.username || '', now, now
        );
        
        await db.run(
            `UPDATE users SET last_seen = ?, username = ? WHERE user_id = ?`,
            now, ctx.from.username || '', userId
        );
        
        // LOG SETIAP INTERAKSI (1% sample biar gak spam)
        if (Math.random() < 0.01) {
            await db.run(
                `INSERT INTO logs (user_id, action, created_at) VALUES (?, 'interaction', ?)`,
                userId, now
            );
        }
    }
    await next();
});

// ========== COMMAND START ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const user = await db.get('SELECT balance, role FROM users WHERE user_id = ?', userId);
    const role = await getUserRole(userId);
    
    const text = await addCredits(
        `╔══════════════════════╗\n` +
        `║  *HERIKEYZENLOCKER*  ║\n` +
        `║    *BOT PREMIUM*     ║\n` +
        `╚══════════════════════╝\n\n` +
        `👤 *User:* ${ctx.from.first_name}\n` +
        `🆔 *ID:* \`${userId}\`\n` +
        `💰 *Saldo:* ${formatRupiah(user?.balance || 0)}\n` +
        `⭐ *Role:* ${role.toUpperCase()}\n\n` +
        `💚 *PEMBAYARAN VIA DANA*\n\n` +
        `${getDanaText()}\n` +
        `📸 *WAJIB KIRIM BUKTI SCREENSHOT!*\n\n` +
        `Pilih menu di bawah:`,
        userId
    );
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 PRODUK 1K-9K', 'menu_produk')],
        [Markup.button.callback('👑 ADP 30K', 'menu_adp')],
        [Markup.button.callback('💰 CEK SALDO', 'menu_saldo')],
        [Markup.button.callback('💚 TOP UP DANA', 'menu_topup')],
        [Markup.button.callback('📦 ORDER SAYA', 'menu_orders')],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        isAdmin(userId) ? [Markup.button.callback('⚙️ ADMIN PANEL', 'menu_admin')] : [],
        [Markup.button.url('📞 CONTACT OWNER', `tg://user?id=${process.env.ADMIN_ID || CONFIG.ADMIN_ID}`)]
    ]);
    
    await sendWithImage(ctx, 'menu_main.jpg', text, keyboard.reply_markup);
    await addLog(userId, 'start', 'Memulai bot');
});

// ========== MENU PRODUK ==========
bot.action('menu_produk', async (ctx) => {
    const userId = ctx.from.id;
    let text = '━━━━━━━━━━━━━━━━━━━━\n';
    text += '     *PRODUK 1K-9K*     \n';
    text += '━━━━━━━━━━━━━━━━━━━━\n\n';
    
    const keyboard = [];
    
    CONFIG.PRODUCTS.slice(0, 9).forEach(p => {
        text += `${p.emoji} *${p.name}*\n`;
        text += `   ├ 💰 Harga: ${formatRupiah(p.price)}\n`;
        text += `   ├ ⚡ CPU: ${p.cpu}%\n`;
        text += `   ├ 🧠 RAM: ${p.ram}MB\n`;
        text += `   └ 💾 Disk: ${p.disk}MB\n\n`;
        
        keyboard.push([Markup.button.callback(
            `${p.emoji} BELI ${p.name}`,
            `beli_${p.id}`
        )]);
    });
    
    // UNLIMITED
    const unlimited = CONFIG.PRODUCTS[9];
    text += `${unlimited.emoji} *${unlimited.name}*\n`;
    text += `   ├ 💰 Harga: ${formatRupiah(unlimited.price)}\n`;
    text += `   ├ ⚡ CPU: ${unlimited.cpu}%\n`;
    text += `   ├ 🧠 RAM: ${unlimited.ram}MB\n`;
    text += `   └ 💾 Disk: ${unlimited.disk}MB\n\n`;
    
    keyboard.push([Markup.button.callback(
        `${unlimited.emoji} BELI UNLIMITED`,
        `beli_${unlimited.id}`
    )]);
    
    // ADP 30K
    const adp = CONFIG.PRODUCTS[10];
    text += `${adp.emoji} *${adp.name}*\n`;
    text += `   ├ 💰 Harga: ${formatRupiah(adp.price)}\n`;
    text += `   ├ ⚡ CPU: ${adp.cpu}%\n`;
    text += `   ├ 🧠 RAM: ${adp.ram}MB\n`;
    text += `   └ 💾 Disk: ${adp.disk}MB\n\n`;
    
    keyboard.push([Markup.button.callback(
        `${adp.emoji} BELI ADMIN PANEL`,
        `beli_${adp.id}`
    )]);
    
    text = await addCredits(text, userId);
    
    keyboard.push([Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')]);
    keyboard.push([Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')]);
    keyboard.push([Markup.button.callback('🔙 KEMBALI', 'back_main')]);
    
    await editWithImage(ctx, 'menu_produk.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== MENU ADP 30K ==========
bot.action('menu_adp', async (ctx) => {
    const userId = ctx.from.id;
    const p = CONFIG.PRODUCTS[10];
    
    const text = await addCredits(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `     *ADMIN PANEL 30K*     \n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${p.emoji} *SPESIFIKASI LENGKAP:*\n` +
        `   ├ ⚡ CPU: ${p.cpu}% (8 Core)\n` +
        `   ├ 🧠 RAM: ${p.ram}MB (16GB)\n` +
        `   ├ 💾 Disk: ${p.disk}MB (100GB)\n` +
        `   ├ 🌐 Bandwidth: Unlimited\n` +
        `   └ ⏱️ Uptime: 99.9%\n\n` +
        `✨ *FITUR PREMIUM:*\n` +
        `   • Akses Full Panel\n` +
        `   • Support All Bot\n` +
        `   • Prioritas Support\n` +
        `   • Anti Lemot\n` +
        `   • Auto Backup Harian\n` +
        `   • Garansi 7 Hari\n\n` +
        `💰 *Harga:* ${formatRupiah(p.price)}\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('✅ BELI SEKARANG', `beli_${p.id}`)],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_adp.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== MENU TOP UP ==========
bot.action('menu_topup', async (ctx) => {
    const userId = ctx.from.id;
    
    const text = await addCredits(
        `💚 *TOP UP VIA DANA* 💚\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${getDanaText()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 *INSTRUKSI LENGKAP:*\n\n` +
        `1️⃣ *Buka aplikasi DANA*\n` +
        `2️⃣ *Pilih menu "Kirim"*\n` +
        `3️⃣ *Masukkan nomor DANA* (pilih salah satu)\n` +
        `4️⃣ *Masukkan jumlah* (pilih nominal di bawah)\n` +
        `5️⃣ *Transfer*\n` +
        `6️⃣ *SCREENSHOT BUKTI TRANSFER*\n` +
        `7️⃣ *Klik tombol "KIRIM BUKTI"*\n` +
        `8️⃣ *Kirim FOTO bukti ke bot*\n\n` +
        `⚠️ *PENTING!*\n` +
        `• Admin akan CEK screenshot Anda\n` +
        `• Saldo akan DITAMBAH setelah bukti VALID\n` +
        `• Tanpa screenshot = saldo tidak masuk\n\n` +
        `Pilih nominal top up:`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('💚 Rp 10.000', 'topup_10000')],
        [Markup.button.callback('💚 Rp 20.000', 'topup_20000')],
        [Markup.button.callback('💚 Rp 50.000', 'topup_50000')],
        [Markup.button.callback('💚 Rp 100.000', 'topup_100000')],
        [Markup.button.callback('💚 Rp 250.000', 'topup_250000')],
        [Markup.button.callback('💚 Rp 500.000', 'topup_500000')],
        [Markup.button.callback('💚 Rp 1.000.000', 'topup_1000000')],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_topup.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== PROSES TOP UP (PILIH NOMINAL) ==========
bot.action(/topup_(\d+)/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    let danaList = '';
    CONFIG.DANA_NUMBERS.forEach(item => {
        danaList += `${item.label}: \`${item.number}\`\n`;
    });
    
    const text = await addCredits(
        `💚 *TOP UP Rp ${amount.toLocaleString()}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *NOMOR DANA TUJUAN:*\n${danaList}\n` +
        `💵 *Jumlah:* Rp ${amount.toLocaleString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📸 *WAJIB KIRIM BUKTI!*\n\n` +
        `✅ *SETELAH TRANSFER:*\n` +
        `1. Screenshot bukti transfer\n` +
        `2. Klik tombol "KIRIM BUKTI"\n` +
        `3. Kirim FOTO buktinya\n` +
        `4. Tunggu admin verifikasi\n\n` +
        `⚠️ *TANPA BUKTI, SALDO TIDAK MASUK!*`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('📸 KIRIM BUKTI SEKARANG', `kirim_bukti_${amount}`)],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 BATAL', 'menu_topup')]
    ];
    
    await editWithImage(ctx, 'loading.gif', text, Markup.inlineKeyboard(keyboard).reply_markup);
    await addLog(userId, 'topup_request', `Rp ${amount}`);
});

// ========== SIAP KIRIM BUKTI ==========
bot.action(/kirim_bukti_(\d+)/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    
    let danaList = '';
    CONFIG.DANA_NUMBERS.forEach(item => {
        danaList += `${item.label}: \`${item.number}\`\n`;
    });
    
    await editWithImage(ctx, 'loading.gif',
        `📸 *KIRIM BUKTI TRANSFER DANA*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *NOMOR DANA TUJUAN:*\n${danaList}\n` +
        `💵 *Jumlah:* Rp ${amount.toLocaleString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Silakan kirim *FOTO SCREENSHOT* bukti transfer\n` +
        `ke chat ini.\n\n` +
        `📌 *CARA KIRIM:*\n` +
        `• Klik icon 📎 (attachment)\n` +
        `• Pilih 📷 Gallery/Camera\n` +
        `• Pilih foto bukti transfer\n` +
        `• Tambahkan CAPTION: "Top up ${amount} ke [nomor]"` +
        `\n  Contoh: "Top up 10000 ke ${CONFIG.DANA_NUMBERS[0].number}"\n` +
        `• Kirim\n\n` +
        `⏱ Admin akan verifikasi dalam 5-10 menit\n` +
        `Saldo akan ditambahkan SETELAH bukti VALID.\n\n` +
        `📖 *Sambil nunggu, baca Al-Qur'an yuk!*`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
            [Markup.button.callback('🔙 BATAL', 'menu_topup')]
        ]).reply_markup
    );
});

// ========== HANDLER FOTO (BUKTI TRANSFER) ==========
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const caption = ctx.message.caption || '';
    
    // CEK APAKAH INI BUKTI TOP UP
    if (caption.toLowerCase().includes('top up') || 
        caption.toLowerCase().includes('topup')) {
        
        // AMBIL AMOUNT DARI CAPTION
        const match = caption.match(/\d+/g);
        let amount = 10000; // DEFAULT
        let danaNumber = CONFIG.DANA_NUMBERS[0].number;
        let danaLabel = CONFIG.DANA_NUMBERS[0].label;
        
        if (match && match.length > 0) {
            amount = parseInt(match[0]);
            
            // CEK APAKAH ADA NOMOR DANA DI CAPTION
            for (let item of CONFIG.DANA_NUMBERS) {
                if (caption.includes(item.number)) {
                    danaNumber = item.number;
                    danaLabel = item.label;
                    break;
                }
            }
        }
        
        // AMBIL FILE ID
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        
        // SIMPAN KE DATABASE
        const result = await db.run(
            `INSERT INTO proofs (user_id, amount, dana_number, dana_label, file_id, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            userId, amount, danaNumber, danaLabel, fileId, moment().format()
        );
        
        const proofId = result.lastID;
        
        // KASIH TAHU USER
        await ctx.reply(
            `✅ *BUKTI TRANSFER DITERIMA!*\n\n` +
            `ID Bukti: #${proofId}\n` +
            `Nominal: Rp ${amount.toLocaleString()}\n` +
            `📞 Nomor DANA Tujuan: ${danaLabel}\n` +
            `   \`${danaNumber}\`\n\n` +
            `⏱ *Status:* Menunggu verifikasi admin\n` +
            `Admin akan cek dan menambahkan saldo dalam 5-10 menit.\n\n` +
            `📌 *Note:* Saldo akan masuk SETELAH diverifikasi.\n\n` +
            `📖 *Sambil nunggu, baca Al-Qur'an yuk!`
        );
        
        // UPDATE TOTAL PROOF USER
        await db.run(
            'UPDATE users SET total_topup = total_topup + 1 WHERE user_id = ?',
            userId
        );
        
        // BUAT LIST NOMOR DANA UNTUK ADMIN
        let danaList = '';
        CONFIG.DANA_NUMBERS.forEach(item => {
            danaList += `• ${item.label}: ${item.number}\n`;
        });
        
        // KIRIM NOTIFIKASI KE ADMIN
        const adminId = parseInt(process.env.ADMIN_ID || CONFIG.ADMIN_ID);
        await ctx.telegram.sendPhoto(
            adminId,
            fileId,
            {
                caption: 
                    `📸 *BUKTI TRANSFER DANA BARU*\n\n` +
                    `ID Bukti: #${proofId}\n` +
                    `User: ${ctx.from.first_name}\n` +
                    `ID User: \`${userId}\`\n` +
                    `Nominal: Rp ${amount.toLocaleString()}\n` +
                    `📞 Nomor DANA Tujuan: ${danaLabel}\n` +
                    `   \`${danaNumber}\`\n` +
                    `📋 *Semua Nomor DANA:*\n${danaList}` +
                    `Waktu: ${moment().format('DD/MM/YY HH:mm')}\n\n` +
                    `🔹 *VERIFIKASI:*\n` +
                    `/verif ${proofId} - jika valid\n` +
                    `/tolak ${proofId} [alasan] - jika tidak valid`,
                parse_mode: 'Markdown'
            }
        );
        
        await addLog(userId, 'upload_proof', `#${proofId} Rp ${amount}`);
    }
});

// ========== COMMAND VERIFIKASI BUKTI (ADMIN) ==========
bot.command('verif', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Format: /verif [id_bukti]');
        return;
    }
    
    const proofId = parseInt(args[1]);
    
    // AMBIL DATA BUKTI
    const proof = await db.get('SELECT * FROM proofs WHERE proof_id = ?', proofId);
    
    if (!proof) {
        await ctx.reply('❌ Bukti tidak ditemukan');
        return;
    }
    
    if (proof.status !== 'pending') {
        await ctx.reply(`❌ Bukti sudah diverifikasi (${proof.status})`);
        return;
    }
    
    // UPDATE STATUS BUKTI
    await db.run(
        `UPDATE proofs SET status = 'verified', verified_at = ?, verified_by = ? 
         WHERE proof_id = ?`,
        moment().format(), ctx.from.id, proofId
    );
    
    // TAMBAH SALDO USER
    await db.run(
        'UPDATE users SET balance = balance + ? WHERE user_id = ?',
        proof.amount, proof.user_id
    );
    
    // KIRIM NOTIF KE USER
    await ctx.telegram.sendMessage(
        proof.user_id,
        `💰 *SALDO MASUK!*\n\n` +
        `✅ Bukti transfer #${proofId} telah DIVERIFIKASI!\n` +
        `💵 Jumlah: Rp ${proof.amount.toLocaleString()}\n` +
        `📞 Nomor DANA Tujuan: ${proof.dana_label}\n` +
        `   \`${proof.dana_number}\`\n\n` +
        `Saldo Anda telah ditambahkan.\n` +
        `Silakan cek saldo dan beli panel yang diinginkan.\n\n` +
        `📖 *Jangan lupa baca Al-Qur'an!*`
    );
    
    await ctx.reply(`✅ Bukti #${proofId} diverifikasi, saldo user ditambahkan`);
    await addLog(ctx.from.id, 'verify_proof', `#${proofId}`);
});

// ========== COMMAND TOLAK BUKTI (ADMIN) ==========
bot.command('tolak', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.re
