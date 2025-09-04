import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import axios from "axios";   
import FormData from "form-data";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer(); 

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/index", (req, res) => {
  res.render("index.ejs");
});

app.get("/government", (req, res) => {
  res.render("government.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/results", (req, res) => {
  res.render("results.ejs");
});

app.post("/verify", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const form = new FormData();
  form.append("file", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    const response = await axios.post("http://localhost:8000/verify", form, {
      headers: form.getHeaders(),
    });
    res.json(response.data);
  } catch (err) {
    console.error("FastAPI error:", err.response?.data || err.message); // 👈 show FastAPI’s error
    res.status(500).json({ error: "Verification failed", detail: err.response?.data || err.message });
  }
});


// app.post("/verify", upload.single("image"), async (req, res) => {
//     const form = new FormData();
//     form.append("file", req.file.buffer, req.file.originalname);

//     const response = await axios.post("http://localhost:8000/verify", form, {
//       headers: form.getHeaders(),
//     });

//     res.json(response.data);
// });

app.listen(port, () => {
  console.log("Server running on port ", port);
});
