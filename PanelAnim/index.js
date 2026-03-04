// ========== HERIKEYZENLOCKER BOT - DANA ONLY VERSION ==========
// File: index.js
// Letak: /Panel-bot/index.js
// Developer: HeriKeyzenlocker
// Version: 8.0.0 - LENGKAP! PANEL + DANA ONLY + NGAJI + ADMIN + PREMIUM + LOGS + BAN + BROADCAST
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
const PROOFS_PATH = path.join(__dirname, 'proofs');

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

// ========== FUNGSI DANA TEXT (HANYA NOMOR) ==========
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
    const dirs = [IMAGES_PATH, LOGS_PATH, PROOFS_PATH];
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

// ========== MENU TOP UP (DANA ONLY) ==========
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
        `3️⃣ *Masukkan nomor DANA* (pilih salah satu di atas)\n` +
        `4️⃣ *Masukkan jumlah* (pilih nominal di bawah)\n` +
        `5️⃣ *Transfer*\n` +
        `6️⃣ *SCREENSHOT BUKTI TRANSFER*\n` +
        `7️⃣ *Kirim FOTO bukti ke bot ini*\n` +
        `8️⃣ *Tunggu admin verifikasi (5-10 menit)*\n\n` +
        `⚠️ *PENTING!*\n` +
        `• Hanya transfer ke nomor DANA di atas\n` +
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
        `2. Kirim FOTO buktinya ke chat ini\n` +
        `3. Tunggu admin verifikasi\n\n` +
        `⚠️ *TANPA BUKTI, SALDO TIDAK MASUK!*`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('🔙 KEMBALI', 'menu_topup')]
    ];
    
    await editWithImage(ctx, 'loading.gif', text, Markup.inlineKeyboard(keyboard).reply_markup);
    await addLog(userId, 'topup_request', `Rp ${amount}`);
});

// ========== HANDLER FOTO (BUKTI TRANSFER DANA) ==========
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const caption = ctx.message.caption || '';
    
    // CEK APAKAH INI BUKTI TOP UP (bisa dengan atau tanpa caption)
    // Tapi lebih baik user kasih caption untuk memudahkan
    
    // AMBIL FILE ID
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    
    // COBA DETEKSI NOMINAL DARI CAPTION
    const match = caption.match(/\d+/g);
    let amount = 0;
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
    
    // SIMPAN KE DATABASE (STATUS PENDING)
    const result = await db.run(
        `INSERT INTO proofs (user_id, amount, dana_number, dana_label, file_id, created_at, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        userId, amount, danaNumber, danaLabel, fileId, moment().format()
    );
    
    const proofId = result.lastID;
    
    // KASIH TAHU USER
    await ctx.reply(
        `✅ *BUKTI TRANSFER DITERIMA!*\n\n` +
        `ID Bukti: #${proofId}\n` +
        `Nominal: ${amount > 0 ? 'Rp ' + amount.toLocaleString() : 'Tidak terdeteksi (perlu cek manual)'}\n` +
        `📞 Nomor DANA Tujuan: ${danaLabel} \`${danaNumber}\`\n\n` +
        `⏱ *Status:* Menunggu verifikasi admin\n` +
        `Admin akan cek dan menambahkan saldo dalam 5-10 menit.\n\n` +
        `📌 *SALDO AKAN MASUK SETELAH DIVERIFIKASI!*\n` +
        `Jangan kirim ulang bukti yang sama.`
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
    
    // KIRIM NOTIFIKASI KE ADMIN (LENGKAP DENGAN FOTO)
    const adminId = parseInt(process.env.ADMIN_ID || CONFIG.ADMIN_ID);
    await ctx.telegram.sendPhoto(
        adminId,
        fileId,
        {
            caption: 
                `📸 *BUKTI TRANSFER DANA BARU*\n\n` +
                `ID Bukti: #${proofId}\n` +
                `User: ${ctx.from.first_name} (@${ctx.from.username || 'no username'})\n` +
                `ID User: \`${userId}\`\n` +
                `Nominal: ${amount > 0 ? 'Rp ' + amount.toLocaleString() : 'Tidak terbaca'}\n` +
                `📞 Nomor DANA Tujuan: ${danaLabel} \`${danaNumber}\`\n` +
                `📋 *Semua Nomor DANA:*\n${danaList}` +
                `Waktu: ${moment().format('DD/MM/YY HH:mm')}\n\n` +
                `🔹 *VERIFIKASI:*\n` +
                `/verif ${proofId} - jika valid\n` +
                `/tolak ${proofId} [alasan] - jika tidak valid`,
            parse_mode: 'Markdown'
        }
    );
    
    await addLog(userId, 'upload_proof', `#${proofId} ${amount > 0 ? 'Rp ' + amount : 'no amount'}`);
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
    
    // KIRIM NOTIF KE USER DENGAN CREDITS
    const credits = await getCredits(proof.user_id);
    await ctx.telegram.sendMessage(
        proof.user_id,
        `💰 *SALDO MASUK!*\n\n` +
        `✅ Bukti transfer #${proofId} telah DIVERIFIKASI!\n` +
        `💵 Jumlah: Rp ${proof.amount.toLocaleString()}\n` +
        `📞 Nomor DANA Tujuan: ${proof.dana_label}\n` +
        `   \`${proof.dana_number}\`\n\n` +
        `Saldo Anda telah ditambahkan.\n` +
        `Silakan cek saldo dan beli panel yang diinginkan.\n\n` +
        `📖 *Jangan lupa baca Al-Qur'an!*` +
        credits
    );
    
    await ctx.reply(`✅ Bukti #${proofId} diverifikasi, saldo user ditambahkan`);
    await addLog(ctx.from.id, 'verify_proof', `#${proofId}`);
});

// ========== COMMAND TOLAK BUKTI (ADMIN) ==========
bot.command('tolak', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Format: /tolak [id_bukti] [alasan]');
        return;
    }
    
    const proofId = parseInt(args[1]);
    const alasan = args.slice(2).join(' ') || 'Tidak sesuai';
    
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
        `UPDATE proofs SET status = 'rejected' WHERE proof_id = ?`,
        proofId
    );
    
    // KIRIM NOTIF KE USER DENGAN CREDITS
    const credits = await getCredits(proof.user_id);
    await ctx.telegram.sendMessage(
        proof.user_id,
        `❌ *BUKTI TRANSFER DITOLAK*\n\n` +
        `ID Bukti: #${proofId}\n` +
        `Nominal: Rp ${proof.amount.toLocaleString()}\n` +
        `📞 Nomor DANA Tujuan: ${proof.dana_label}\n` +
        `   \`${proof.dana_number}\`\n` +
        `Alasan: ${alasan}\n\n` +
        `Silakan cek kembali transfer Anda dan kirim ulang bukti.\n\n` +
        `📖 *Tetap semangat!*` +
        credits
    );
    
    await ctx.reply(`✅ Bukti #${proofId} ditolak`);
    await addLog(ctx.from.id, 'reject_proof', `#${proofId} - ${alasan}`);
});

// ========== CEK SALDO ==========
bot.action('menu_saldo', async (ctx) => {
    const userId = ctx.from.id;
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', userId);
    
    // HITUNG BUKTI PENDING
    const pending = await db.get(
        'SELECT COUNT(*) as total FROM proofs WHERE user_id = ? AND status = "pending"',
        userId
    );
    
    // HITUNG TOTAL ORDER
    const totalOrder = await db.get(
        'SELECT COUNT(*) as total FROM orders WHERE user_id = ?',
        userId
    );
    
    const text = await addCredits(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       *CEK SALDO*       \n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *Saldo Aktif:* ${formatRupiah(user?.balance || 0)}\n` +
        `⏳ *Bukti Pending:* ${pending?.total || 0}\n` +
        `📦 *Total Order:* ${totalOrder?.total || 0}\n\n` +
        `${getDanaText()}\n` +
        `📌 *Catatan:*\n` +
        `• Transfer ke nomor DANA di atas\n` +
        `• Kirim screenshot bukti\n` +
        `• Tunggu verifikasi admin\n` +
        `• Saldo akan bertambah\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('💚 TOP UP DANA', 'menu_topup')],
        [Markup.button.callback('📋 RIWAYAT BUKTI', 'riwayat_bukti')],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_saldo.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== RIWAYAT BUKTI ==========
bot.action('riwayat_bukti', async (ctx) => {
    const userId = ctx.from.id;
    
    const proofs = await db.all(
        'SELECT * FROM proofs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        userId
    );
    
    if (proofs.length === 0) {
        await editWithImage(ctx, 'menu_saldo.jpg',
            '📸 Belum ada riwayat bukti transfer',
            Markup.inlineKeyboard([
                [Markup.button.callback('💚 TOP UP DANA', 'menu_topup')],
                [Markup.button.callback('🔙 KEMBALI', 'menu_saldo')]
            ]).reply_markup
        );
        return;
    }
    
    let text = '📸 *RIWAYAT BUKTI TRANSFER*\n\n';
    
    proofs.forEach((p, i) => {
        let statusEmoji = '⏳';
        if (p.status === 'verified') statusEmoji = '✅';
        if (p.status === 'rejected') statusEmoji = '❌';
        
        text += `${statusEmoji} *#${p.proof_id}*\n`;
        text += `   ├ 💵 Rp ${p.amount.toLocaleString()}\n`;
        text += `   ├ 📞 ${p.dana_label}\n`;
        text += `   ├ 📅 ${moment(p.created_at).format('DD/MM/YY HH:mm')}\n`;
        text += `   └ 📊 ${p.status}\n\n`;
    });
    
    text += '━━━━━━━━━━━━━━━━━━━━';
    
    const finalText = await addCredits(text, userId);
    
    await editWithImage(ctx, 'menu_saldo.jpg', finalText,
        Markup.inlineKeyboard([
            [Markup.button.callback('💚 TOP UP LAGI', 'menu_topup')],
            [Markup.button.callback('🔙 KEMBALI', 'menu_saldo')]
        ]).reply_markup
    );
});

// ========== BELI PRODUK (HARUS PUNYA SALDO) ==========
bot.action(/beli_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = CONFIG.PRODUCTS.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ Produk tidak ditemukan');
        return;
    }
    
    const userId = ctx.from.id;
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', userId);
    
    if (user.balance >= product.price) {
        // SALDO CUKUP - PROSES ORDER
        const orderId = generateId();
        const password = generatePass();
        const now = moment().format();
        const expiredAt = moment().add(30, 'days').format();
        
        await db.run(
            `INSERT INTO orders (order_id, user_id, product_id, product_name, price, password, status, created_at, activated_at, expired_at) 
             VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
            orderId, userId, productId, product.name, product.price, password, now, now, expiredAt
        );
        
        // POTONG SALDO
        await db.run(
            'UPDATE users SET balance = balance - ?, total_order = total_order + 1 WHERE user_id = ?',
            product.price, userId
        );
        
        const text = await addCredits(
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `   *ORDER BERHASIL!*   \n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🆔 *Order ID:* \`${orderId}\`\n` +
            `📦 *Produk:* ${product.name}\n` +
            `💰 *Harga:* ${formatRupiah(product.price)}\n\n` +
            `🔐 *DETAIL LOGIN:*\n` +
            `   ├ 🌐 Panel: ${process.env.PANEL_URL || CONFIG.PANEL_URL}\n` +
            `   ├ 👤 Username: \`user${userId}\`\n` +
            `   └ 🔑 Password: \`${password}\`\n\n` +
            `📅 *Expired:* ${moment(expiredAt).format('DD/MM/YYYY')}\n\n` +
            `📌 Simpan password baik-baik!\n` +
            `━━━━━━━━━━━━━━━━━━━━`,
            userId
        );
        
        const keyboard = [
            [Markup.button.callback('📦 CEK ORDER', 'menu_orders')],
            [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
            [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
            [Markup.button.callback('🛒 BELI LAGI', 'menu_produk')]
        ];
        
        await editWithImage(ctx, 'success.gif', text, Markup.inlineKeyboard(keyboard).reply_markup);
        await addLog(userId, 'buy_product', `${product.name} - ${orderId}`);
        
    } else {
        // SALDO KURANG - SURUH TOP UP DULU
        const kurang = product.price - user.balance;
        
        const text = await addCredits(
            `⚠️ *SALDO TIDAK CUKUP*\n\n` +
            `💰 Saldo: ${formatRupiah(user.balance)}\n` +
            `💵 Harga: ${formatRupiah(product.price)}\n` +
            `📉 Kurang: ${formatRupiah(kurang)}\n\n` +
            `Silakan TOP UP DANA terlebih dahulu:\n\n` +
            `${getDanaText()}\n\n` +
            `📸 *CARA TOP UP:*\n` +
            `1. Transfer ke nomor DANA di atas\n` +
            `2. Screenshot bukti transfer\n` +
            `3. Kirim FOTO bukti ke bot\n` +
            `4. Tunggu admin verifikasi\n` +
            `5. Saldo akan masuk setelah diverifikasi\n\n` +
            `📖 *Sambil nunggu, baca Al-Qur'an yuk!*`,
            userId
        );
        
        const keyboard = [
            [Markup.button.callback('💚 TOP UP DANA', 'menu_topup')],
            [Markup.button.callback('📸 CEK BUKTI SAYA', 'riwayat_bukti')],
            [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
            [Markup.button.callback('🔙 KEMBALI', 'menu_produk')]
        ];
        
        await editWithImage(ctx, 'menu_produk.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
    }
});

// ========== ORDER SAYA ==========
bot.action('menu_orders', async (ctx) => {
    const userId = ctx.from.id;
    
    const orders = await db.all(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        userId
    );
    
    if (orders.length === 0) {
        await editWithImage(ctx, 'menu_orders.jpg',
            '📦 Belum ada order. Silakan beli produk terlebih dahulu.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🛒 BELI SEKARANG', 'menu_produk')],
                [Markup.button.callback('🔙 KEMBALI', 'back_main')]
            ]).reply_markup
        );
        return;
    }
    
    let text = '━━━━━━━━━━━━━━━━━━━━\n';
    text += '     *ORDER TERAKHIR*     \n';
    text += '━━━━━━━━━━━━━━━━━━━━\n\n';
    
    orders.forEach((o, i) => {
        let statusEmoji = o.status === 'active' ? '✅' : '⏳';
        text += `${statusEmoji} *${i+1}. ${o.product_name}*\n`;
        text += `   ├ 🆔 \`${o.order_id}\`\n`;
        text += `   ├ 💰 ${formatRupiah(o.price)}\n`;
        if (o.password) {
            text += `   ├ 🔐 \`${o.password}\`\n`;
        }
        text += `   └ 📅 ${moment(o.created_at).format('DD/MM/YY')}\n\n`;
    });
    
    text += '━━━━━━━━━━━━━━━━━━━━';
    
    const finalText = await addCredits(text, userId);
    
    const keyboard = [
        [Markup.button.callback('🛒 BELI LAGI', 'menu_produk')],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_orders.jpg', finalText, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== MENU NGAJI ==========
bot.action('menu_ngaji', async (ctx) => {
    const userId = ctx.from.id;
    
    const text = await addCredits(
        `📖 *FITUR NGAJI AL-QURAN* 📖\n\n` +
        `"Sebaik-baik kalian adalah yang mempelajari Al-Qur'an dan mengajarkannya."\n` +
        `(HR. Bukhari)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Pilih opsi di bawah untuk membaca Al-Qur'an:\n\n` +
        `1️⃣ *Daftar Surah* - Lihat semua surah\n` +
        `2️⃣ *Surah Random* - Dapatkan surah acak\n` +
        `3️⃣ *Ayat Pilihan* - Ayat random penuh berkah\n` +
        `4️⃣ *Cari Surah* - Cari berdasarkan nomor\n\n` +
        `Semoga berkah dan mendapat syafaat di akhirat. Aamiin. 🤲`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('📋 DAFTAR SURAH', 'ngaji_list')],
        [Markup.button.callback('🎲 SURAH RANDOM', 'ngaji_random')],
        [Markup.button.callback('✨ AYAT PILIHAN', 'ngaji_ayat')],
        [Markup.button.callback('🔍 CARI SURAH', 'ngaji_search')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_ngaji.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== NGAJI: DAFTAR SURAH ==========
bot.action('ngaji_list', async (ctx) => {
    const userId = ctx.from.id;
    let text = '📋 *DAFTAR SURAH AL-QURAN*\n\n';
    
    CONFIG.SURAH_LIST.forEach(s => {
        text += `${s.number}. ${s.name} (${s.arab}) - ${s.ayat} ayat\n`;
    });
    
    text += `\nKetik /surah [nomor] untuk membaca surah tertentu.\nContoh: /surah 36 untuk Yasin`;
    
    const finalText = await addCredits(text, userId);
    
    const keyboard = [
        [Markup.button.callback('🔙 KEMBALI KE MENU NGAJI', 'menu_ngaji')]
    ];
    
    await ctx.editMessageText(finalText, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
});

// ========== NGAJI: SURAH RANDOM ==========
bot.action('ngaji_random', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.editMessageText('🕋 *Mengambil surah acak...*', { parse_mode: 'Markdown' });
    
    const randomSurah = CONFIG.SURAH_LIST[Math.floor(Math.random() * CONFIG.SURAH_LIST.length)];
    
    try {
        const response = await axios.get(`https://api.alquran.cloud/v1/surah/${randomSurah.number}`);
        
        if (response.data && response.data.data) {
            const surah = response.data.data;
            
            let text = `📖 *SURAH RANDOM*\n\n` +
                `📌 *${surah.number}. ${surah.englishName}*\n` +
                `🕌 *Arab:* ${surah.name}\n` +
                `📊 *Jumlah Ayat:* ${surah.numberOfAyahs}\n` +
                `📍 *Turun di:* ${surah.revelationType}\n\n` +
                `🔹 *Ayat Pertama:*\n` +
                `_"${surah.ayahs[0].text}"_\n\n` +
                `Ketik /surah ${surah.number} untuk membaca lengkap.`;
            
            const finalText = await addCredits(text, userId);
            
            const keyboard = [
                [Markup.button.callback('🎲 ACAK LAGI', 'ngaji_random')],
                [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
            ];
            
            await ctx.editMessageText(finalText, {
                parse_mode: 'Markdown',
                reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
            });
        } else {
            await ctx.editMessageText('❌ Gagal mengambil surah. Coba lagi nanti.', {
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
                ]).reply_markup
            });
        }
    } catch (error) {
        await ctx.editMessageText('❌ Gagal mengambil surah. Coba lagi nanti.', {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
            ]).reply_markup
        });
    }
});

// ========== NGAJI: AYAT PILIHAN ==========
bot.action('ngaji_ayat', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.editMessageText('✨ *Mengambil ayat pilihan...*', { parse_mode: 'Markdown' });
    
    const result = await getRandomAyat();
    
    if (result.success) {
        let text = `✨ *AYAT PILIHAN*\n\n` +
            `📖 *Surah:* ${result.surah}\n` +
            `🕌 *Arab:* ${result.arab}\n` +
            `🔢 *Ayat ke-${result.ayatNumber}*\n\n` +
            `_"${result.text}"_\n\n` +
            `_"Dan bacalah Al-Qur'an dengan tartil."_\n` +
            `(QS. Al-Muzzammil: 4)`;
        
        const finalText = await addCredits(text, userId);
        
        const keyboard = [
            [Markup.button.callback('✨ AYAT LAIN', 'ngaji_ayat')],
            [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
        ];
        
        await ctx.editMessageText(finalText, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        });
    } else {
        await ctx.editMessageText('❌ Gagal mengambil ayat. Coba lagi nanti.', {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
            ]).reply_markup
        });
    }
});

// ========== NGAJI: CARI SURAH ==========
bot.action('ngaji_search', async (ctx) => {
    const userId = ctx.from.id;
    
    const text = await addCredits(
        `🔍 *CARI SURAH*\n\n` +
        `Gunakan command /surah [nomor] untuk membaca surah tertentu.\n\n` +
        `Contoh:\n` +
        `/surah 1 - Al-Fatihah\n` +
        `/surah 36 - Yasin\n` +
        `/surah 55 - Ar-Rahman\n` +
        `/surah 67 - Al-Mulk\n\n` +
        `Atau ketik nomor surah yang ingin dibaca.`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('🔙 KEMBALI', 'menu_ngaji')]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
});

// ========== COMMAND SURAH ==========
bot.command('surah', async (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
        await ctx.reply('❌ Gunakan: /surah [nomor]\nContoh: /surah 36');
        return;
    }
    
    const surahNumber = parseInt(args[1]);
    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
        await ctx.reply('❌ Nomor surah tidak valid. Gunakan nomor 1-114.');
        return;
    }
    
    await ctx.reply('🕋 *Mengambil surah...*', { parse_mode: 'Markdown' });
    
    try {
        const response = await axios.get(`https://api.alquran.cloud/v1/surah/${surahNumber}`);
        
        if (response.data && response.data.data) {
            const surah = response.data.data;
            
            let text = `📖 *SURAH ${surah.englishName}*\n\n` +
                `📌 *Nomor:* ${surah.number}\n` +
                `🕌 *Arab:* ${surah.name}\n` +
                `📊 *Jumlah Ayat:* ${surah.numberOfAyahs}\n` +
                `📍 *Turun di:* ${surah.revelationType}\n\n` +
                `🔹 *Ayat Pertama:*\n` +
                `_"${surah.ayahs[0].text}"_\n\n` +
                `Mau baca ayat selanjutnya? Cari di Google atau tanya owner.`;
            
            const finalText = await addCredits(text, userId);
            
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('📖 KEMBALI KE MENU NGAJI', 'menu_ngaji')]
            ]);
            
            await ctx.reply(finalText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard.reply_markup
            });
        } else {
            await ctx.reply('❌ Gagal mengambil surah. Coba lagi nanti.');
        }
    } catch (error) {
        await ctx.reply('❌ Gagal mengambil surah. Coba lagi nanti.');
    }
});

// ========== MENU ABOUT ==========
bot.action('menu_about', async (ctx) => {
    const userId = ctx.from.id;
    
    const totalUsers = await db.get('SELECT COUNT(*) as total FROM users');
    const totalOrders = await db.get('SELECT COUNT(*) as total FROM orders');
    const totalVerified = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "verified"');
    const totalPending = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "pending"');
    
    const text = await addCredits(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `     *TENTANG BOT*     \n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🤖 *Nama:* ${CONFIG.BOT_NAME || 'HERIKEYZENLOCKER BOT'}\n` +
        `👑 *Owner:* @HeriKeyzenlocker\n` +
        `👨‍💻 *Developer:* HeriKeyzenlocker\n` +
        `📦 *Versi:* 8.0.0\n` +
        `📅 *Update:* 04 Maret 2026\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *STATISTIK BOT*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👥 *Total User:* ${totalUsers?.total || 0}\n` +
        `📦 *Total Order:* ${totalOrders?.total || 0}\n` +
        `✅ *Transaksi Sukses:* ${totalVerified?.total || 0}\n` +
        `⏳ *Pending:* ${totalPending?.total || 0}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📖 *FITUR NGAJI*\n` +
        `• Daftar Surah\n` +
        `• Surah Random\n` +
        `• Ayat Pilihan\n` +
        `• Cari Surah\n\n` +
        `💚 *Dibuat dengan cinta dan berkah*\n` +
        `© 2026 HERI KEYZEN`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.url('🌟 FOLLOW GITHUB', 'https://github.com/hereikoprasetyo7')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_about.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== ADMIN PANEL ==========
bot.action('menu_admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Bukan admin!');
        return;
    }
    
    const userId = ctx.from.id;
    
    // HITUNG BUKTI PENDING
    const pending = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "pending"');
    const totalUsers = await db.get('SELECT COUNT(*) as total FROM users');
    const totalOrders = await db.get('SELECT COUNT(*) as total FROM orders');
    
    let danaList = '';
    CONFIG.DANA_NUMBERS.forEach(item => {
        danaList += `   • ${item.label}: ${item.number}\n`;
    });
    
    const text = await addCredits(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `      *ADMIN PANEL*      \n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 *STATISTIK:*\n` +
        `   ├ 👥 Total User: ${totalUsers?.total || 0}\n` +
        `   ├ ⏳ Bukti Pending: ${pending?.total || 0}\n` +
        `   └ 📦 Total Order: ${totalOrders?.total || 0}\n\n` +
        `💚 *NOMOR DANA PENERIMA:*\n${danaList}\n` +
        `⚙️ *COMMAND ADMIN:*\n\n` +
        `🔹 /verif [id_bukti]\n` +
        `   Verifikasi bukti transfer\n\n` +
        `🔹 /tolak [id_bukti] [alasan]\n` +
        `   Tolak bukti transfer\n\n` +
        `🔹 /listpending\n` +
        `   Lihat semua bukti pending\n\n` +
        `🔹 /broadcast [pesan]\n` +
        `   Kirim pesan ke semua user\n\n` +
        `🔹 /ban [user_id]\n` +
        `   Blokir user\n\n` +
        `🔹 /unban [user_id]\n` +
        `   Buka blokir user\n\n` +
        `🔹 /stats\n` +
        `   Statistik lengkap\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
        userId
    );
    
    const keyboard = [
        [Markup.button.callback('📋 LIST PENDING', 'list_pending_admin')],
        [Markup.button.callback('📖 FITUR NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT BOT', 'menu_about')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ];
    
    await editWithImage(ctx, 'menu_admin.jpg', text, Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== LIST PENDING ADMIN ==========
bot.action('list_pending_admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const userId = ctx.from.id;
    
    const proofs = await db.all(
        'SELECT * FROM proofs WHERE status = "pending" ORDER BY created_at ASC'
    );
    
    if (proofs.length === 0) {
        await ctx.editMessageText('✅ Tidak ada bukti pending', {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🔙 KEMBALI', 'menu_admin')]
            ]).reply_markup
        });
        return;
    }
    
    let text = '📋 *BUKTI PENDING*\n\n';
    
    proofs.forEach(p => {
        text += `#${p.proof_id}\n`;
        text += `   ├ 👤 User: ${p.user_id}\n`;
        text += `   ├ 💵 Rp ${p.amount.toLocaleString()}\n`;
        text += `   ├ 📞 ${p.dana_label}\n`;
        text += `   ├ 📅 ${moment(p.created_at).format('DD/MM/YY HH:mm')}\n`;
        text += `   └ 🔹 /verif ${p.proof_id}\n\n`;
    });
    
    const finalText = await addCredits(text, userId);
    
    await ctx.editMessageText(finalText, { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🔙 KEMBALI', 'menu_admin')]
        ]).reply_markup
    });
});

// ========== COMMAND LIST PENDING ==========
bot.command('listpending', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const proofs = await db.all(
        'SELECT * FROM proofs WHERE status = "pending" ORDER BY created_at ASC'
    );
    
    if (proofs.length === 0) {
        await ctx.reply('✅ Tidak ada bukti pending');
        return;
    }
    
    let text = '📋 *BUKTI PENDING*\n\n';
    
    proofs.forEach(p => {
        text += `#${p.proof_id}\n`;
        text += `   ├ 👤 User: ${p.user_id}\n`;
        text += `   ├ 💵 Rp ${p.amount.toLocaleString()}\n`;
        text += `   └ 🔹 /verif ${p.proof_id}\n\n`;
    });
    
    await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ========== COMMAND BROADCAST ==========
bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin!');
        return;
    }
    
    const message = ctx.message.text.replace('/broadcast ', '');
    if (!message) {
        await ctx.reply('Format: /broadcast [pesan]');
        return;
    }
    
    await ctx.reply('⏳ *Mengirim broadcast...*', { parse_mode: 'Markdown' });
    
    const users = await db.all('SELECT user_id FROM users WHERE is_banned = 0');
    let sent = 0;
    let failed = 0;
    
    for (const user of users) {
        try {
            const credits = await getCredits(user.user_id);
            await ctx.telegram.sendMessage(
                user.user_id,
                `📢 *BROADCAST MESSAGE*\n\n${message}\n` + credits,
                { parse_mode: 'Markdown' }
            );
            sent++;
        } catch (err) {
            failed++;
        }
        // Delay biar gak kena spam limit
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await ctx.reply(`✅ Broadcast selesai!\n📨 Terkirim: ${sent}\n❌ Gagal: ${failed}`);
    
    await db.run(
        `INSERT INTO broadcasts (message, total_sent, total_failed, created_by, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        message, sent, failed, ctx.from.id, moment().format()
    );
});

// ========== COMMAND BAN ==========
bot.command('ban', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Format: /ban [user_id]');
        return;
    }
    
    const targetId = parseInt(args[1]);
    const alasan = args.slice(2).join(' ') || 'Melanggar aturan';
    
    await db.run('UPDATE users SET is_banned = 1, ban_reason = ? WHERE user_id = ?', alasan, targetId);
    
    await ctx.reply(`✅ User ${targetId} telah diblokir\nAlasan: ${alasan}`);
    await addLog(ctx.from.id, 'ban_user', `${targetId} - ${alasan}`);
});

// ========== COMMAND UNBAN ==========
bot.command('unban', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin!');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Format: /unban [user_id]');
        return;
    }
    
    const targetId = parseInt(args[1]);
    
    await db.run('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE user_id = ?', targetId);
    
    await ctx.reply(`✅ User ${targetId} telah dibuka blokirnya`);
    await addLog(ctx.from.id, 'unban_user', `${targetId}`);
});

// ========== COMMAND STATS ==========
bot.command('stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    
    const totalUsers = await db.get('SELECT COUNT(*) as total FROM users');
    const totalOrders = await db.get('SELECT COUNT(*) as total FROM orders');
    const totalProofs = await db.get('SELECT COUNT(*) as total FROM proofs');
    const totalVerified = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "verified"');
    const totalPending = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "pending"');
    const totalRejected = await db.get('SELECT COUNT(*) as total FROM proofs WHERE status = "rejected"');
    
    const totalBalance = await db.get('SELECT SUM(balance) as total FROM users');
    const totalRevenue = await db.get('SELECT SUM(price) as total FROM orders WHERE status = "active"');
    
    const text = 
        `📊 *STATISTIK BOT LENGKAP*\n\n` +
        `👥 *Users:* ${totalUsers?.total || 0}\n` +
        `📦 *Orders:* ${totalOrders?.total || 0}\n` +
        `📸 *Total Proofs:* ${totalProofs?.total || 0}\n` +
        `✅ *Verified:* ${totalVerified?.total || 0}\n` +
        `⏳ *Pending:* ${totalPending?.total || 0}\n` +
        `❌ *Rejected:* ${totalRejected?.total || 0}\n\n` +
        `💰 *Total Balance User:* ${formatRupiah(totalBalance?.total || 0)}\n` +
        `💵 *Total Revenue:* ${formatRupiah(totalRevenue?.total || 0)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👑 *OWNER:* @HeriKeyzenlocker\n` +
        `👨‍💻 *DEVELOPER:* HeriKeyzenlocker\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ========== BACK TO MAIN ==========
bot.action('back_main', async (ctx) => {
    const userId = ctx.from.id;
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', userId);
    
    const text = await addCredits(
        `╔══════════════════════╗\n` +
        `║  *HERIKEYZENLOCKER*  ║\n` +
        `╚══════════════════════╝\n\n` +
        `👤 ${ctx.from.first_name}\n` +
        `💰 ${formatRupiah(user?.balance || 0)}`,
        userId
    );
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 PRODUK', 'menu_produk')],
        [Markup.button.callback('👑 ADP', 'menu_adp')],
        [Markup.button.callback('💰 SALDO', 'menu_saldo')],
        [Markup.button.callback('💚 TOP UP', 'menu_topup')],
        [Markup.button.callback('📦 ORDER', 'menu_orders')],
        [Markup.button.callback('📖 NGAJI', 'menu_ngaji')],
        [Markup.button.callback('ℹ️ ABOUT', 'menu_about')],
        isAdmin(userId) ? [Markup.button.callback('⚙️ ADMIN', 'menu_admin')] : [],
        [Markup.button.url('📞 OWNER', `tg://user?id=${process.env.ADMIN_ID || CONFIG.ADMIN_ID}`)]
    ]);
    
    await editWithImage(ctx, 'menu_main.jpg', text, keyboard.reply_markup);
});

// ========== JALANKAN BOT ==========
async function start() {
    await setupDB();
    bot.launch();
    
    console.log('╔════════════════════════════════╗');
    console.log('║   HERIKEYZENLOCKER BOT v8.0  ║');
    console.log('╠════════════════════════════════╣');
    console.log('║   👑 OWNER: @HeriKeyzenlocker  ║');
    console.log('║   👨‍💻 DEV: HeriKeyzenlocker    ║');
    console.log('║   📦 Versi: 8.0.0              ║');
    console.log('║   💚 DANA ONLY                  ║');
    console.log('║   ✅ BOT JALAN!                ║');
    console.log('╚════════════════════════════════╝');
    
    // Kirim notifikasi ke admin
    const adminId = parseInt(process.env.ADMIN_ID || CONFIG.ADMIN_ID);
    try {
        await bot.telegram.sendMessage(
            adminId,
            `✅ *BOT TELAH DIAKTIFKAN*\n\n` +
            `📦 Versi: 8.0.0\n` +
            `👑 Owner: @HeriKeyzenlocker\n` +
            `👨‍💻 Developer: HeriKeyzenlocker\n` +
            `📖 Fitur Ngaji: Aktif\n` +
            `💚 DANA ONLY: 2 nomor siap menerima pembayaran.\n\n` +
            `Barakallah, semoga berkah! 🤲`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.log('Tidak bisa kirim notifikasi ke admin');
    }
}

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start();
