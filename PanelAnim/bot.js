// ==================== BOT PANEL DENGAN ANIMASI JPG ====================
// Semua menu pake gambar animasi
// JS File - Taruh di folder PanelAnim/

const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// ========== KONFIGURASI (GANTI INI!) ==========
const BOT_TOKEN = '8123456789:AAHxyz...';  // GANTI TOKEN LU!
const ADMIN_ID = 123456789;                 // GANTI ID LU!
const PANEL_URL = 'https://panel.lu.com';    // GANTI URL PANEL!

// ========== PRODUK ==========
const PRODUCTS = [
    { id: 'p1k', name: 'RAM 1GB', price: 1000, cpu: 100, ram: 1024, disk: 5000, icon: '🪙' },
    { id: 'p2k', name: 'RAM 2GB', price: 2000, cpu: 150, ram: 2048, disk: 10000, icon: '🥉' },
    { id: 'p3k', name: 'RAM 3GB', price: 3000, cpu: 200, ram: 3072, disk: 15000, icon: '🥈' },
    { id: 'p4k', name: 'RAM 4GB', price: 4000, cpu: 250, ram: 4096, disk: 20000, icon: '🥇' },
    { id: 'p5k', name: 'RAM 5GB', price: 5000, cpu: 300, ram: 5120, disk: 25000, icon: '💎' },
    { id: 'p6k', name: 'RAM 6GB', price: 6000, cpu: 350, ram: 6144, disk: 30000, icon: '👑' },
    { id: 'p7k', name: 'RAM 7GB', price: 7000, cpu: 400, ram: 7168, disk: 35000, icon: '⚡' },
    { id: 'p8k', name: 'RAM 8GB', price: 8000, cpu: 450, ram: 8192, disk: 40000, icon: '🔥' },
    { id: 'p9k', name: 'RAM 9GB', price: 9000, cpu: 500, ram: 9216, disk: 45000, icon: '🚀' },
    { id: 'adp30k', name: 'ADMIN PANEL', price: 30000, cpu: 800, ram: 16384, disk: 100000, icon: '👑' }
];

// ========== REKENING ==========
const BANKS = [
    '🏦 BCA: 1234567890 a.n Heri',
    '📱 DANA: 081234567890 a.n Heri',
    '📱 GOPAY: 081234567890 a.n Heri'
];

// ========== SETUP BOT ==========
const bot = new Telegraf(BOT_TOKEN);
let db;

// ========== FUNGSI HELPER ==========
const helpers = {
    generateId: () => 'INV-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex'),
    
    generatePass: () => crypto.randomBytes(4).toString('hex'),
    
    formatRupiah: (amount) => 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    
    getImagePath: (name) => path.join(__dirname, 'images', name),
    
    isAdmin: (userId) => userId === ADMIN_ID,
    
    sendWithImage: async (ctx, imageName, caption, keyboard) => {
        try {
            const imagePath = helpers.getImagePath(imageName);
            if (fs.existsSync(imagePath)) {
                await ctx.replyWithPhoto(
                    { source: imagePath },
                    { 
                        caption: caption,
                        parse_mode: 'Markdown',
                        ...(keyboard && { reply_markup: keyboard })
                    }
                );
            } else {
                await ctx.reply(caption, { 
                    parse_mode: 'Markdown',
                    ...(keyboard && { reply_markup: keyboard })
                });
            }
        } catch (err) {
            await ctx.reply(caption, { 
                parse_mode: 'Markdown',
                ...(keyboard && { reply_markup: keyboard })
            });
        }
    },
    
    editWithImage: async (ctx, imageName, caption, keyboard) => {
        try {
            await ctx.deleteMessage();
            const imagePath = helpers.getImagePath(imageName);
            if (fs.existsSync(imagePath)) {
                await ctx.replyWithPhoto(
                    { source: imagePath },
                    { 
                        caption: caption,
                        parse_mode: 'Markdown',
                        ...(keyboard && { reply_markup: keyboard })
                    }
                );
            } else {
                await ctx.reply(caption, { 
                    parse_mode: 'Markdown',
                    ...(keyboard && { reply_markup: keyboard })
                });
            }
        } catch (err) {
            await ctx.reply(caption, { 
                parse_mode: 'Markdown',
                ...(keyboard && { reply_markup: keyboard })
            });
        }
    }
};

// ========== DATABASE ==========
async function setupDB() {
    db = await open({
        filename: path.join(__dirname, 'data', 'database.sqlite'),
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            name TEXT,
            username TEXT,
            balance INTEGER DEFAULT 0,
            joined TEXT
        );
        
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            user_id INTEGER,
            product TEXT,
            price INTEGER,
            password TEXT,
            status TEXT DEFAULT 'pending',
            created TEXT
        );
    `);
    console.log('✅ Database siap');
}

// ========== MIDDLEWARE ==========
bot.use(async (ctx, next) => {
    if (ctx.from) {
        await db.run(
            `INSERT OR IGNORE INTO users (user_id, name, username, joined) VALUES (?, ?, ?, ?)`,
            ctx.from.id,
            ctx.from.first_name,
            ctx.from.username || '',
            moment().format()
        );
    }
    await next();
});

// ========== COMMAND START DENGAN ANIMASI ==========
bot.start(async (ctx) => {
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', ctx.from.id);
    
    const caption = 
        `✨ *SELAMAT DATANG DI BOT PANEL PREMIUM* ✨\n\n` +
        `👤 *User:* ${ctx.from.first_name}\n` +
        `🆔 *ID:* \`${ctx.from.id}\`\n` +
        `💰 *Saldo:* ${helpers.formatRupiah(user.balance)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛍️ *PILIH MENU DI BAWAH:*\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 PRODUK 1K-9K', 'menu_produk')],
        [Markup.button.callback('👑 ADMIN PANEL 30K', 'menu_adp')],
        [Markup.button.callback('💰 CEK SALDO', 'menu_saldo')],
        [Markup.button.callback('📦 PESANAN SAYA', 'menu_pesanan')],
        [Markup.button.callback('❓ CARA ORDER', 'menu_cara')],
        helpers.isAdmin(ctx.from.id) ? [Markup.button.callback('⚙️ ADMIN PANEL', 'menu_admin')] : []
    ]);
    
    await helpers.sendWithImage(ctx, 'menu_main.jpg', caption, keyboard.reply_markup);
});

// ========== MENU PRODUK DENGAN ANIMASI ==========
bot.action('menu_produk', async (ctx) => {
    let caption = '━━━━━━━━━━━━━━━━━━━━\n';
    caption += '        🛒 *PRODUK TERSEDIA* 🛒\n';
    caption += '━━━━━━━━━━━━━━━━━━━━\n\n';
    
    const keyboard = [];
    
    PRODUCTS.slice(0, 9).forEach(p => {
        caption += `${p.icon} *${p.name}*\n`;
        caption += `   ├ 💰 Harga: ${helpers.formatRupiah(p.price)}\n`;
        caption += `   ├ ⚡ CPU: ${p.cpu}%\n`;
        caption += `   ├ 🧠 RAM: ${p.ram}MB\n`;
        caption += `   └ 💾 Disk: ${p.disk}MB\n\n`;
        
        keyboard.push([Markup.button.callback(
            `${p.icon} BELI ${p.name} ${helpers.formatRupiah(p.price)}`,
            `beli_${p.id}`
        )]);
    });
    
    keyboard.push([Markup.button.callback('🔙 KEMBALI KE MENU', 'back_main')]);
    
    await helpers.editWithImage(ctx, 'menu_produk.jpg', caption, 
        Markup.inlineKeyboard(keyboard).reply_markup);
});

// ========== MENU ADP 30K DENGAN ANIMASI ==========
bot.action('menu_adp', async (ctx) => {
    const p = PRODUCTS[9];
    
    const caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `     👑 *ADMIN PANEL 30K* 👑\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📦 *Spesifikasi:*\n` +
        `   ├ ⚡ CPU: ${p.cpu}%\n` +
        `   ├ 🧠 RAM: ${p.ram}MB\n` +
        `   ├ 💾 Disk: ${p.disk}MB\n` +
        `   └ 💰 Harga: ${helpers.formatRupiah(p.price)}\n\n` +
        `✨ *Fitur Premium:*\n` +
        `   • Akses Full Panel\n` +
        `   • Support All Bot\n` +
        `   • Prioritas Support\n` +
        `   • Anti Lemot\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ BELI SEKARANG', `beli_${p.id}`)],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'menu_admin.jpg', caption, keyboard.reply_markup);
});

// ========== CEK SALDO DENGAN ANIMASI ==========
bot.action('menu_saldo', async (ctx) => {
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', ctx.from.id);
    
    let caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `        💰 *INFORMASI SALDO* 💰\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💵 *Saldo Anda:* ${helpers.formatRupiah(user.balance)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*🏦 REKENING TOP UP:*\n`;
    
    BANKS.forEach(b => caption += `• ${b}\n`);
    
    caption += `\n📌 *Catatan:*\n` +
        `• Transfer sesuai nominal\n` +
        `• Kirim bukti ke admin\n` +
        `• Saldo masuk otomatis\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('📞 CHAT ADMIN', `tg://user?id=${ADMIN_ID}`)],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'menu_saldo.jpg', caption, keyboard.reply_markup);
});

// ========== PESANAN SAYA DENGAN ANIMASI ==========
bot.action('menu_pesanan', async (ctx) => {
    const orders = await db.all(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY rowid DESC LIMIT 5',
        ctx.from.id
    );
    
    if (orders.length === 0) {
        await ctx.answerCbQuery('❌ Belum ada pesanan');
        return;
    }
    
    let caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       📦 *PESANAN TERAKHIR* 📦\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    orders.forEach((o, i) => {
        caption += `*${i+1}. ID:* \`${o.order_id}\`\n`;
        caption += `   ├ 📦 Produk: ${o.product}\n`;
        caption += `   ├ 💰 Harga: ${helpers.formatRupiah(o.price)}\n`;
        caption += `   ├ 🔐 Pass: \`${o.password || 'pending'}\`\n`;
        caption += `   └ 📊 Status: ${o.status === 'active' ? '✅ AKTIF' : '⏳ PENDING'}\n\n`;
    });
    
    caption += `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'menu_pesanan.jpg', caption, keyboard.reply_markup);
});

// ========== CARA ORDER DENGAN ANIMASI ==========
bot.action('menu_cara', async (ctx) => {
    const caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       ❓ *CARA ORDER PANEL* ❓\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Langkah-langkah:*\n\n` +
        `1️⃣ *Pilih Produk*\n` +
        `   Klik menu produk dan pilih\n` +
        `   spesifikasi yang diinginkan\n\n` +
        `2️⃣ *Transfer Pembayaran*\n` +
        `   Transfer ke rekening yang\n` +
        `   tersedia sesuai harga\n\n` +
        `3️⃣ *Konfirmasi*\n` +
        `   Klik "SUDAH TRANSFER" dan\n` +
        `   kirim bukti ke admin\n\n` +
        `4️⃣ *Aktivasi*\n` +
        `   Admin akan aktivasi dalam\n` +
        `   waktu 5-10 menit\n\n` +
        `5️⃣ *Login Panel*\n` +
        `   Gunakan username & password\n` +
        `   yang dikirim bot\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'menu_cara.jpg', caption, keyboard.reply_markup);
});

// ========== MENU ADMIN (KHUSUS OWNER) ==========
bot.action('menu_admin', async (ctx) => {
    if (!helpers.isAdmin(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Bukan admin!');
        return;
    }
    
    const caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       ⚙️ *ADMIN PANEL* ⚙️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `*Menu Khusus Admin:*\n\n` +
        `🔹 /addsaldo [user_id] [jumlah]\n` +
        `   Tambah saldo user\n\n` +
        `🔹 /aktivasi [order_id]\n` +
        `   Aktivasi pesanan\n\n` +
        `🔹 /users\n` +
        `   Lihat 10 user terbaru\n\n` +
        `🔹 /orders\n` +
        `   Lihat pesanan pending\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'menu_admin.jpg', caption, keyboard.reply_markup);
});

// ========== PROSES BELI ==========
bot.action(/beli_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = PRODUCTS.find(p => p.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ Produk tidak ditemukan');
        return;
    }
    
    const caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       🛍️ *KONFIRMASI PEMBELIAN* 🛍️\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📦 *Produk:* ${product.icon} ${product.name}\n` +
        `💰 *Harga:* ${helpers.formatRupiah(product.price)}\n\n` +
        `⚙️ *Spesifikasi:*\n` +
        `   ├ ⚡ CPU: ${product.cpu}%\n` +
        `   ├ 🧠 RAM: ${product.ram}MB\n` +
        `   └ 💾 Disk: ${product.disk}MB\n\n` +
        `🏦 *Transfer ke:*\n` +
        `${BANKS[0]}\n\n` +
        `✅ Klik "SUDAH TRANSFER" setelah bayar\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ SUDAH TRANSFER', `sudah_${product.id}`)],
        [Markup.button.callback('❌ BATAL', 'menu_produk')]
    ]);
    
    await helpers.editWithImage(ctx, 'loading.gif', caption, keyboard.reply_markup);
});

// ========== SUDAH TRANSFER ==========
bot.action(/sudah_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = PRODUCTS.find(p => p.id === productId);
    const userId = ctx.from.id;
    
    const orderId = helpers.generateId();
    const password = helpers.generatePass();
    
    await db.run(
        'INSERT INTO orders (order_id, user_id, product, price, password, created) VALUES (?, ?, ?, ?, ?, ?)',
        orderId, userId, product.name, product.price, password, moment().format()
    );
    
    // Notifikasi admin
    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       🛒 *ORDER BARU* 🛒\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 *User:* ${ctx.from.first_name}\n` +
        `🆔 *ID:* \`${userId}\`\n` +
        `📦 *Produk:* ${product.name}\n` +
        `💰 *Harga:* ${helpers.formatRupiah(product.price)}\n` +
        `🆔 *Order:* \`${orderId}\`\n\n` +
        `📌 User sudah transfer, segera aktivasi!\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
    
    // Notifikasi user
    const caption = 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `       ✅ *ORDER DIBUAT* ✅\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🆔 *Order ID:* \`${orderId}\`\n` +
        `📦 *Produk:* ${product.name}\n` +
        `💰 *Harga:* ${helpers.formatRupiah(product.price)}\n\n` +
        `⏳ *Status:* Menunggu aktivasi admin\n\n` +
        `📌 Password akan dikirim otomatis\n` +
        `setelah diaktivasi admin\n\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('📞 HUBUNGI ADMIN', `tg://user?id=${ADMIN_ID}`)],
        [Markup.button.callback('📦 CEK PESANAN', 'menu_pesanan')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    
    await helpers.editWithImage(ctx, 'success.gif', caption, keyboard.reply_markup);
});

// ========== KEMBALI KE MENU UTAMA ==========
bot.action('back_main', async (ctx) => {
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', ctx.from.id);
    
    const caption = 
        `✨ *SELAMAT DATANG DI BOT PANEL PREMIUM* ✨\n\n` +
        `👤 *User:* ${ctx.from.first_name}\n` +
        `🆔 *ID:* \`${ctx.from.id}\`\n` +
        `💰 *Saldo:* ${helpers.formatRupiah(user.balance)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛍️ *PILIH MENU DI BAWAH:*\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 PRODUK 1K-9K', 'menu_produk')],
        [Markup.button.callback('👑 ADMIN PANEL 30K', 'menu_adp')],
        [Markup.button.callback('💰 CEK SALDO', 'menu_saldo')],
        [Markup.button.callback('📦 PESANAN SAYA', 'menu_pesanan')],
        [Markup.button.callback('❓ CARA ORDER', 'menu_cara')],
        helpers.isAdmin(ctx.from.id) ? [Markup.button.callback('⚙️ ADMIN PANEL', 'menu_admin')] : []
    ]);
    
    await helpers.editWithImage(ctx, 'menu_main.jpg', caption, keyboard.reply_markup);
});

// ========== COMMAND ADMIN ==========
bot.command('addsaldo', async (ctx) => {
    if (!helpers.isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        await ctx.reply('Format: /addsaldo user_id jumlah');
        return;
    }
    
    const targetId = parseInt(args[1]);
    const amount = parseInt(args[2]);
    
    await db.run(
        'UPDATE users SET balance = balance + ? WHERE user_id = ?',
        amount, targetId
    );
    
    await ctx.reply(`✅ Saldo user ${targetId} +${helpers.formatRupiah(amount)}`);
    await ctx.telegram.sendMessage(
        targetId,
        `💰 Saldo Anda bertambah ${helpers.formatRupiah(amount)}`
    );
});

bot.command('aktivasi', async (ctx) => {
    if (!helpers.isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin');
        return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Format: /aktivasi INV-XXXX');
        return;
    }
    
    const orderId = args[1];
    
    await db.run('UPDATE orders SET status = ? WHERE order_id = ?', 'active', orderId);
    
    const order = await db.get('SELECT * FROM orders WHERE order_id = ?', orderId);
    
    if (order) {
        await ctx.telegram.sendMessage(
            order.user_id,
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `       ✅ *ORDER DIACTIVATE* ✅\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🆔 *Order ID:* \`${orderId}\`\n` +
            `📦 *Produk:* ${order.product}\n\n` +
            `🔐 *DETAIL LOGIN:*\n` +
            `   ├ 🌐 Panel: ${PANEL_URL}\n` +
            `   ├ 👤 Username: \`user${order.user_id}\`\n` +
            `   └ 🔑 Password: \`${order.password}\`\n\n` +
            `📌 Simpan password baik-baik!\n` +
            `━━━━━━━━━━━━━━━━━━━━`
        );
        
        await ctx.reply(`✅ Order ${orderId} diaktifkan`);
    }
});

bot.command('users', async (ctx) => {
    if (!helpers.isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Bukan admin');
        return;
    }
    
    const users = await db.all('SELECT * FROM users ORDER BY rowid DESC LIMIT 10');
    
    let msg = '━━━━━━━━━━━━━━━━━━━━\n';
    msg += '       👥 *10 USER TERBARU* 👥\n';
    msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
    
    users.forEach((u, i) => {
        msg += `*${i+1}.* \`${u.user_id}\`\n`;
        msg += `   ├ 👤 ${u.name}\n`;
        msg += `   ├ 💰 ${helpers.formatRupiah(u.balance)}\n`;
        msg += `   └ 📅 ${moment(u.joined).format('DD/MM/YY')}\n\n`;
    });
    
    msg += '━━━━━━━━━━━━━━━━━━━━';
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ========== JALANKAN BOT ==========
async function start() {
    // Buat folder images kalau belum ada
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Buat folder data kalau belum ada
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    await setupDB();
    bot.launch();
    
    console.log('╔════════════════════════════════╗');
    console.log('║   BOT PANEL DENGAN ANIMASI    ║');
    console.log('╠════════════════════════════════╣');
    console.log(`║ 📁 Folder: PanelAnim           ║`);
    console.log(`║ 📦 Produk: ${PRODUCTS.length} item          ║`);
    console.log(`║ 👤 Admin ID: ${ADMIN_ID}        ║`);
    console.log('╚════════════════════════════════╝');
}

start();
