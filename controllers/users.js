let userModel = require("../schemas/users");
let roleModel = require("../schemas/roles");
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let fs = require('fs')
let ExcelJS = require('exceljs')

module.exports = {
    CreateAnUser: async function (username, password, email, role, session, fullName, avatarUrl, status, loginCount) {
        let newItem = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        });
        await newItem.save({ session });
        return newItem;
    },
    GetAllUser: async function () {
        return await userModel
            .find({ isDeleted: false })
    },
    GetUserById: async function (id) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    _id: id
                }).populate('role')
        } catch (error) {
            return false;
        }
    },
    GetUserByEmail: async function (email) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    email: email
                })
        } catch (error) {
            return false;
        }
    },
    GetUserByToken: async function (token) {
        try {
            let user = await userModel
                .findOne({
                    isDeleted: false,
                    forgotPasswordToken: token
                })
            if (user.forgotPasswordTokenExp > Date.now()) {
                return user;
            }
            return false;
        } catch (error) {
            return false;
        }
    },
    QueryLogin: async function (username, password) {
        if (!username || !password) {
            return false;
        }
        let user = await userModel.findOne({
            username: username,
            isDeleted: false
        })
        if (user) {
            if (user.lockTime && user.lockTime > Date.now()) {
                return false;
            } else {
                if (bcrypt.compareSync(password, user.password)) {
                    user.loginCount = 0;
                    await user.save();
                    let token = jwt.sign({
                        id: user.id
                    }, 'secret', {
                        expiresIn: '1d'
                    })
                    return token;
                } else {
                    //sai pass
                    user.loginCount++;
                    if (user.loginCount == 3) {
                        user.loginCount = 0;
                        user.lockTime = Date.now() + 3_600_000;
                    }
                    await user.save();
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    ChangePassword: async function (user, oldPassword, newPassword) {
        if (bcrypt.compareSync(oldPassword, user.password)) {
            user.password = newPassword;
            await user.save();
            return true;
        } else {
            return false;
        }
    },

    ImportUsers: async function (filePath) {
        const { sendPasswordEmail } = require('../utils/sendMail');

        // Lấy role USER, nếu không có thì lấy role đầu tiên trong DB
        let defaultRole = await roleModel.findOne({ name: /^user$/i, isDeleted: false });
        if (!defaultRole) {
            defaultRole = await roleModel.findOne({ isDeleted: false });
        }
        if (!defaultRole) {
            throw new Error("Không tìm thấy role nào trong database. Hãy tạo role trước.");
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        // Tự động detect cột username và email từ header row
        const headerRow = worksheet.getRow(1);
        let usernameCol = null;
        let emailCol = null;
        headerRow.eachCell((cell, colNumber) => {
            const header = cell.value?.toString().trim().toLowerCase();
            if (header === 'username') usernameCol = colNumber;
            if (header === 'email') emailCol = colNumber;
        });

        if (!usernameCol || !emailCol) {
            throw new Error("File Excel thiếu cột 'username' hoặc 'email'.");
        }

        // Hàm sinh password ngẫu nhiên 16 ký tự (chữ hoa, thường, số, ký tự đặc biệt)
        function generatePassword(length = 16) {
            const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            let password = '';
            for (let i = 0; i < length; i++) {
                password += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            return password;
        }

        const rowErrors = [];
        // Mỗi user có password riêng => xử lý từng row
        const userDataList = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const username = row.getCell(usernameCol).value?.toString().trim();
            const email = row.getCell(emailCol).value?.toString().trim().toLowerCase();

            if (!username || !email) {
                rowErrors.push({ row: rowNumber, reason: 'username hoặc email bị trống' });
                return;
            }

            const plainPassword = generatePassword(16);
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(plainPassword, salt);

            userDataList.push({
                doc: {
                    username,
                    email,
                    password: hashedPassword,
                    role: defaultRole._id,
                    status: false
                },
                plainPassword, // Giữ lại để gửi email
                username,
                email
            });
        });

        // insertMany ordered:false => bỏ qua duplicate
        const insertedUsernames = new Set();
        let insertedCount = 0;
        let duplicateErrors = [];

        try {
            const docs = userDataList.map(u => u.doc);
            const result = await userModel.insertMany(docs, { ordered: false });
            insertedCount = result.length;
            result.forEach(u => insertedUsernames.add(u.username));
        } catch (err) {
            if (err.writeErrors) {
                const failedUsernames = new Set(err.writeErrors.map(e => e.err?.op?.username));
                insertedCount = userDataList.length - err.writeErrors.length;
                duplicateErrors = err.writeErrors.map(e => ({
                    username: e.err?.op?.username,
                    reason: 'Đã tồn tại (username hoặc email trùng)'
                }));
                // Chỉ gửi mail cho user insert thành công
                userDataList.forEach(u => {
                    if (!failedUsernames.has(u.username)) insertedUsernames.add(u.username);
                });
            } else {
                throw err;
            }
        }

        // Gửi email song song cho các user đã được insert thành công
        const emailTasks = userDataList
            .filter(u => insertedUsernames.has(u.username))
            .map(u => sendPasswordEmail(u.email, u.username, u.plainPassword));

        const emailResults = await Promise.allSettled(emailTasks);
        const emailErrors = emailResults
            .map((r, i) => r.status === 'rejected'
                ? { username: userDataList[i].username, reason: 'Gửi email thất bại: ' + r.reason?.message }
                : null
            )
            .filter(Boolean);

        return {
            total: userDataList.length,
            inserted: insertedCount,
            errors: [...rowErrors, ...duplicateErrors, ...emailErrors]
        };
    }
}