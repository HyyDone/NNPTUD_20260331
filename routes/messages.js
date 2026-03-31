var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/messages");
let { CheckLogin } = require("../utils/authHandler");
let { uploadImage } = require("../utils/uploadHandler");
let path = require("path");

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/messages/
// Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện mà user hiện tại tham gia
// ─────────────────────────────────────────────────────────────────
router.get("/", CheckLogin, async function (req, res, next) {
    try {
        const currentUserId = req.user._id;

        // Lấy tất cả tin nhắn liên quan đến user hiện tại, sort mới nhất trước
        const messages = await messageModel
            .find({
                $or: [{ from: currentUserId }, { to: currentUserId }]
            })
            .sort({ createdAt: -1 })
            .populate("from", "username email")
            .populate("to", "username email");

        // Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện (theo partner)
        const conversationMap = new Map();

        for (const msg of messages) {
            // Xác định "đối tác" trong cuộc trò chuyện
            const partnerId =
                msg.from._id.toString() === currentUserId.toString()
                    ? msg.to._id.toString()
                    : msg.from._id.toString();

            // Map chỉ lưu tin nhắn đầu tiên gặp (vì đã sort mới nhất trước)
            if (!conversationMap.has(partnerId)) {
                conversationMap.set(partnerId, msg);
            }
        }

        const lastMessages = Array.from(conversationMap.values());
        res.send(lastMessages);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/messages/:userID
// Lấy toàn bộ hội thoại giữa user hiện tại và userID
// ─────────────────────────────────────────────────────────────────
router.get("/:userID", CheckLogin, async function (req, res, next) {
    try {
        const currentUserId = req.user._id;
        const targetUserId = req.params.userID;

        const messages = await messageModel
            .find({
                $or: [
                    { from: currentUserId, to: targetUserId },
                    { from: targetUserId, to: currentUserId }
                ]
            })
            .sort({ createdAt: 1 }) // cũ → mới
            .populate("from", "username email")
            .populate("to", "username email");

        res.send(messages);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/v1/messages/
// Gửi tin nhắn (text hoặc file) đến một user khác
// Body (form-data):
//   - to      : ObjectId của người nhận
//   - text    : nội dung (nếu là tin nhắn text)
//   - file    : file đính kèm (nếu là tin nhắn file)
// ─────────────────────────────────────────────────────────────────
router.post(
    "/",
    CheckLogin,
    uploadImage.single("file"), // multer xử lý field "file" (nếu có)
    async function (req, res, next) {
        try {
            const currentUserId = req.user._id;
            const { to, text } = req.body;

            if (!to) {
                return res.status(400).send({ message: "Thiếu trường 'to' (người nhận)" });
            }

            let messageContent;

            if (req.file) {
                // Có file đính kèm → type = "file", text = đường dẫn file
                messageContent = {
                    type: "file",
                    text: path.join("uploads", req.file.filename).replace(/\\/g, "/")
                };
            } else if (text && text.trim() !== "") {
                // Chỉ có text → type = "text"
                messageContent = {
                    type: "text",
                    text: text.trim()
                };
            } else {
                return res.status(400).send({ message: "Vui lòng cung cấp nội dung tin nhắn (text hoặc file)" });
            }

            const newMessage = new messageModel({
                from: currentUserId,
                to: to,
                messageContent: messageContent
            });

            await newMessage.save();

            const populated = await messageModel
                .findById(newMessage._id)
                .populate("from", "username email")
                .populate("to", "username email");

            res.status(201).send(populated);
        } catch (err) {
            res.status(500).send({ message: err.message });
        }
    }
);

module.exports = router;
