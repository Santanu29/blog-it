import express, { json } from "express";
import cors from "cors";
import { connect } from "mongoose";
import { genSaltSync, hashSync, compareSync } from "bcrypt";
import User from "./models/User.js";
import Post from "./models/Post.js";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { configDotenv } from "dotenv";
import multer from "multer";
const uploadMiddleware = multer({ dest: "uploads/" });
import { renameSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const salt = genSaltSync(10);
// const secret = process.env.SECRET;
const secret = "asleihrqo2358has8r7";
const port = process.env.PORT || 4000;

configDotenv();

const app = express();
app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(json());
app.use(cookieParser());

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(__dirname + "\\uploads"));

connect(process.env.MONGO_URL);

app.get("/test", (req, res) => {
  res.json("API is working fine");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const userDoc = await User.create({ username, password: hashSync(password, salt) });
    res.json(userDoc);
  } catch (err) {
    res.status(400).json(err.message);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = compareSync(password, userDoc.password);

  if (passOk) {
    // logged in
    console.log("inside passOK");
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json("ok");
    });
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
  res.json(req.cookies);
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json({
    id: userDoc._id,
    username,
  });
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = `${path}.${ext}`;
  renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({ title, summary, content, cover: newPath, author: info.id });
    console.log(newPath);
    res.json(postDoc);
  });
});

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = `${path}.${ext}`;
    renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });
});

app.get("/post", async (req, res) => {
  const allPosts = await Post.find()
    .populate("author", ["username"])
    .sort({ createdAt: -1 })
    .limit(20);
  res.json(allPosts);
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

console.log(`Running at port ${port}`);
app.listen(port);
