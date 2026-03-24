var express = require("express");
var router = express.Router();
let bcrypt = require('bcrypt')
let path = require('path')
let fs = require('fs')
let userModel = require("../schemas/users");
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator')
let userController = require('../controllers/users')
let { CheckLogin, checkRole } = require('../utils/authHandler')
let { uploadExcel } = require('../utils/uploadHandler')


router.get("/", CheckLogin, checkRole("ADMIN","MODERATOR"), async function (req, res, next) {//ADMIN
  let users = await userController.GetAllUser()
  res.send(users);
});

router.get("/:id", async function (req, res, next) {
  let result = await userController.GetUserById(
    req.params.id
  )
  if (result) {
    res.send(result);
  } else {
    res.status(404).send({ message: "id not found" })
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  
  try {
    let user = await userController.CreateAnUser(
      req.body.username, req.body.password,
      req.body.email, req.body.role
    )
    res.send(user);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate
      (id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" })
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// Import users từ file Excel (.xlsx)
// POST /users/import  - form-data với field "file" là file .xlsx
router.post("/import", CheckLogin, checkRole("ADMIN"), uploadExcel.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send({ message: "Vui lòng upload file Excel (.xlsx)" });
  }

  const filePath = path.join(__dirname, '../uploads', req.file.filename);
  try {
    const result = await userController.ImportUsers(filePath);
    res.send({
      message: `Import hoàn tất. Đã thêm ${result.inserted}/${result.total} user.`,
      inserted: result.inserted,
      total: result.total,
      errors: result.errors
    });
  } catch (err) {
    res.status(400).send({ message: err.message });
  } finally {
    // Xóa file tạm sau khi xử lý
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

module.exports = router;