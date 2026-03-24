const { MailtrapClient } = require("mailtrap");

// ✅ Điền API Token từ Mailtrap vào đây (Settings → API Tokens)
const MAILTRAP_TOKEN = "";

// ✅ Điền Inbox ID nếu dùng Sandbox (Email Testing → Inboxes → chọn inbox → lấy ID trên URL)
const MAILTRAP_INBOX_ID = 0;

// Đặt true để test qua Sandbox, false để gửi email thật (Production)
const USE_SANDBOX = true;

const client = new MailtrapClient({
    token: MAILTRAP_TOKEN,
    sandbox: USE_SANDBOX,
    testInboxId: USE_SANDBOX ? MAILTRAP_INBOX_ID : undefined,
});

module.exports = {
    sendMail: async function (to, url) {
        await client.send({
            from: { name: "Coffee Shop Admin", email: "admin@coffeeshop.com" },
            to: [{ email: to }],
            subject: "Reset password email",
            text: "Click vao day de doi pass: " + url,
            html: "Click vao <a href=" + url + ">day</a> de doi pass",
        });
    },

    sendPasswordEmail: async function (to, username, password) {
        await client.send({
            from: { name: "Coffee Shop Admin", email: "admin@coffeeshop.com" },
            to: [{ email: to }],
            subject: "Tài khoản của bạn đã được tạo",
            text: `Xin chào ${username},\n\nTài khoản của bạn đã được tạo thành công.\nUsername: ${username}\nPassword: ${password}\n\nVui lòng đổi mật khẩu sau khi đăng nhập lần đầu.\n\nTrân trọng,\nCoffee Shop Admin`,
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; }
    .container { max-width:520px; margin:40px auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
    .header { background:linear-gradient(135deg,#6f4e37,#c8a47e); padding:32px 24px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:22px; letter-spacing:1px; }
    .header p { color:#f5e6d8; margin:6px 0 0; font-size:13px; }
    .body { padding:28px 32px; }
    .body p { color:#444; line-height:1.7; font-size:15px; }
    .credentials { background:#fdf5ed; border:1px solid #e8cfa8; border-radius:8px; padding:16px 20px; margin:20px 0; }
    .credentials p { margin:6px 0; font-size:15px; color:#5a3e28; }
    .credentials strong { color:#3d2310; }
    .credentials .password-value { font-family:monospace; font-size:17px; font-weight:bold; letter-spacing:2px; color:#c0392b; background:#fff0f0; padding:4px 10px; border-radius:5px; display:inline-block; }
    .warning { background:#fff8e1; border-left:4px solid #f39c12; padding:12px 16px; border-radius:4px; margin-top:16px; font-size:13px; color:#7d5a00; }
    .footer { background:#f9f0e8; padding:16px 32px; text-align:center; font-size:12px; color:#999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>☕ Coffee Shop</h1>
      <p>Hệ thống quản lý nội bộ</p>
    </div>
    <div class="body">
      <p>Xin chào <strong>${username}</strong>,</p>
      <p>Tài khoản của bạn đã được tạo thành công trên hệ thống. Dưới đây là thông tin đăng nhập:</p>
      <div class="credentials">
        <p>👤 <strong>Username:</strong> ${username}</p>
        <p>🔑 <strong>Password:</strong> <span class="password-value">${password}</span></p>
      </div>
      <div class="warning">
        ⚠️ <strong>Lưu ý:</strong> Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu tiên để bảo mật tài khoản.
      </div>
      <p style="margin-top:20px;">Trân trọng,<br/><strong>Coffee Shop Admin</strong></p>
    </div>
    <div class="footer">© 2026 Coffee Shop. All rights reserved.</div>
  </div>
</body>
</html>`,
        });
    }
}
