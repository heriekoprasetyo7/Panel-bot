// ==================== BOT JUAL PANEL SIMPLE ====================
// Cuma 1 file, semua fitur ada!
// Copy paste, ganti token, jalan!

const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const crypto = require('crypto');

// ========== KONFIGURASI (GANTI INI DOANG!) ==========
const BOT_TOKEN = '8123456789:AAHxyz...';  // GANTI DENGAN TOKEN LU!
const ADMIN_ID = 123456789;                 // GANTI DENGAN ID TELEGRAM LU!
const PANEL_URL = 'https://panel.lu.com';    // GANTI DENGAN URL PANEL LU

// ========== PRODUK (EDIT KALO MAU) ==========
const PRODUCTS = {
    ram1: { name: 'RAM 1GB', price: 5000, cpu: 100, ram: 1024, disk: 5120 },
    ram2: { name: 'RAM 2GB', price: 10000, cpu: 150, ram: 2048, disk: 10240 },
    ram4: { name: 'RAM 4GB', price: 20000, cpu: 200, ram: 4096, disk: 20480 },
    unlimited: { name: 'UNLIMITED', price: 50000, cpu: 400, ram: 8192, disk: 51200 }
};

// ========== REKENING (EDIT KALO MAU) ==========
const BANKS = [
    'BCA: 1234567890 a.n Heri',
    'Mandiri: 1234567890 a.n Heri',
    'DANA: 081234567890 a.n Heri'
];

// ========== INISIALISASI BOT ==========
const bot = new Telegraf(BOT_TOKEN);
let db;

// ========== FUNGSI BANTUAN ==========
function generateId() {
    return 'INV-' + Date.now().toString(36).toUpperCase();
}

function generatePass() {
    return crypto.randomBytes(6).toString('hex');
}

function formatRupiah(amount) {
    return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ========== SETUP DATABASE ==========
async function setupDB() {
    db = await open({
        filename: './data/database.sqlite',
        driver: sqlite3.Database
    });
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            balance INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            user_id INTEGER,
            product TEXT,
            password TEXT,
            expiry TEXT
        );
    `);
    console.log('✅ Database siap');
}

// ========== HANDLER START ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    
    // Simpan user
    await db.run('INSERT OR IGNORE INTO users (user_id) VALUES (?)', userId);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🛒 LIHAT PRODUK', callback_data: 'products' }],
            [{ text: '💰 CEK SALDO', callback_data: 'balance' }],
            [{ text: '📦 SERVER SAYA', callback_data: 'myservers' }],
            [{ text: '❓ CARA ORDER', callback_data: 'howto' }]
        ]
    };
    
    await ctx.reply(
        `🎉 SELAMAT DATANG!\n\nID: ${userId}\nPilih menu di bawah:`,
        { reply_markup: keyboard }
    );
});

// ========== LIHAT PRODUK ==========
bot.action('products', async (ctx) => {
    let msg = '🛒 PRODUK PANEL:\n\n';
    const keyboard = { inline_keyboard: [] };
    
    for (const [id, p] of Object.entries(PRODUCTS)) {
        msg += `${p.name}\n`;
        msg += `   CPU: ${p.cpu}% | RAM: ${p.ram}MB\n`;
        msg += `   Harga: ${formatRupiah(p.price)}\n\n`;
        keyboard.inline_keyboard.push([{
            text: `BELI ${p.name} - ${formatRupiah(p.price)}`,
            callback_data: `buy_${id}`
        }]);
    }
    
    keyboard.inline_keyboard.push([{ text: '🔙 KEMBALI', callback_data: 'back' }]);
    
    await ctx.editMessageText(msg, { reply_markup: keyboard });
});

// ========== CEK SALDO ==========
bot.action('balance', async (ctx) => {
    const userId = ctx.from.id;
    const user = await db.get('SELECT balance FROM users WHERE user_id = ?', userId);
    
    let msg = `💰 SALDO: ${formatRupiah(user?.balance || 0)}\n\n`;
    msg += 'TOP UP:\n';
    BANKS.forEach(b => msg += `• ${b}\n`);
    msg += '\nKirim bukti ke admin';
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔙 KEMBALI', callback_data: 'back' }]
        ]
    };
    
    await ctx.editMessageText(msg, { reply_markup: keyboard });
});

// ========== SERVER SAYA ==========
bot.action('myservers', async (ctx) => {
    const userId = ctx.from.id;
    const orders = await db.all(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY expiry DESC',
        userId
    );
    
    if (orders.length === 0) {
        await ctx.editMessageText('❌ Belum punya server', {
            reply_markup: { inline_keyboard: [[{ text: '🔙 KEMBALI', callback_data: 'back' }]] }
        });
        return;
    }
    
    let msg = '📦 SERVER SAYA:\n\n';
    orders.forEach(o => {
        msg += `• ${PRODUCTS[o.product]?.name || 'Panel'}\n`;
        msg += `  ID: ${o.order_id}\n`;
        msg += `  Exp: ${o.expiry}\n`;
        msg += `  Pass: ${o.password}\n\n`;
    });
    
    await ctx.editMessageText(msg, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 KEMBALI', callback_data: 'back' }]] }
    });
});

// ========== CARA ORDER ==========
bot.action('howto', async (ctx) => {
    const msg = `
❓ CARA ORDER:
1. Pilih produk
2. Klik BELI
3. Transfer sesuai harga
4. Kirim bukti ke admin
5. Dapatkan akses panel

⏱ Proses: 5-10 menit
    `;
    
    await ctx.editMessageText(msg, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 KEMBALI', callback_data: 'back' }]] }
    });
});

// ========== PROSES BELI ==========
bot.action(/buy_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = PRODUCTS[productId];
    
    if (!product) {
        await ctx.answerCbQuery('❌ Produk error');
        return;
    }
    
    const msg = `
🛒 KONFIRMASI:
${product.name}
Harga: ${formatRupiah(product.price)}

Spesifikasi:
CPU: ${product.cpu}%
RAM: ${product.ram}MB
Disk: ${product.disk}MB

Transfer ke:
${BANKS[0]}

Klik SUDAH TRANSFER setelah bayar
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '✅ SUDAH TRANSFER', callback_data: `paid_${productId}` }],
            [{ text: '🔙 BATAL', callback_data: 'products' }]
        ]
    };
    
    await ctx.editMessageText(msg, { reply_markup: keyboard });
});

// ========== SUDAH TRANSFER ==========
bot.action(/paid_(.+)/, async (ctx) => {
    const productId = ctx.match[1];
    const product = PRODUCTS[productId];
    const userId = ctx.from.id;
    
    // Generate order
    const orderId = generateId();
    const password = generatePass();
    const expiry = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('id-ID');
    
    // Simpan ke database
    await db.run(
        'INSERT INTO orders (order_id, user_id, product, password, expiry) VALUES (?, ?, ?, ?, ?)',
        orderId, userId, productId, password, expiry
    );
    
    // Kirim ke admin
    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🛒 ORDER BARU!\nUser: ${userId}\nProduk: ${product.name}\nHarga: ${formatRupiah(product.price)}\nOrder: ${orderId}`
    );
    
    // Kirim ke user
    const msg = `
✅ ORDER DIPROSES!

ID: ${orderId}
Panel: ${PANEL_URL}
User: user${userId}
Pass: ${password}
Exp: ${expiry}

Tunggu admin aktivasi (5-10 menit)
    `;
    
    const keyboard = {
        inline_keyboard: [[{ text: '📦 CEK SERVER', callback_data: 'myservers' }]]
    };
    
    await ctx.editMessageText(msg, { reply_markup: keyboard });
});

// ========== ADMIN: TAMBAH SALDO ==========
bot.command('addsaldo', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
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
    
    await ctx.reply(`✅ Saldo user ${targetId} ditambah ${formatRupiah(amount)}`);
    await ctx.telegram.sendMessage(targetId, `💰 Saldo +${formatRupiah(amount)}`);
});

// ========== ADMIN: BROADCAST ==========
bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('❌ Bukan admin');
        return;
    }
    
    const msg = ctx.message.text.replace('/broadcast ', '');
    const users = await db.all('SELECT user_id FROM users');
    
    let sent = 0;
    for (const u of users) {
        try {
            await ctx.telegram.sendMessage(u.user_id, `📢 ${msg}`);
            sent++;
        } catch (e) {}
    }
    
    await ctx.reply(`✅ Terkirim ke ${sent} user`);
});

// ========== KEMBALI ==========
bot.action('back', async (ctx) => {
    const keyboard = {
        inline_keyboard: [
            [{ text: '🛒 LIHAT PRODUK', callback_data: 'products' }],
            [{ text: '💰 CEK SALDO', callback_data: 'balance' }],
            [{ text: '📦 SERVER SAYA', callback_data: 'myservers' }],
            [{ text: '❓ CARA ORDER', callback_data: 'howto' }]
        ]
    };
    
    await ctx.editMessageText('🏠 MENU UTAMA:', { reply_markup: keyboard });
});

// ========== JALANKAN BOT ==========
async function start() {
    await setupDB();
    bot.launch();
    console.log('✅ BOT JALAN!');
    console.log(`👤 Admin ID: ${ADMIN_ID}`);
    console.log(`📦 Produk: ${Object.keys(PRODUCTS).length} item`);
}

start();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
