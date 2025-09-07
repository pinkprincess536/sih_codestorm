
const express=require('express');
const app=express();
const path=require('path');
const port=process.env.PORT || 5000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get('/', (req, res) => {
res.render("index");
});

app.get('/company-dashboard', (req, res) => {
res.render("comp_dashboard");
});

app.get('/company-login', (req, res) => {
res.render("comp_login");
});


app.get('/company-enrollment', (req, res) => {
res.render("comp_enrollment");
});


app.get('/company-upload', (req, res) => {
res.render("comp_upload");
});




app.get('/government-login', (req, res) => {
res.render("govt_login");
});


app.get('/government-admin', (req, res) => {
res.render("govt_admin");
});

app.get('/university-admin', (req, res) => {
res.render("uni_admin");
});





app.get('/university-database', (req, res) => {
res.render("uni_database");
});

app.get('/university-upload', (req, res) => {
res.render("uni_upload");
});

app.get('/university-login', (req, res) => {
res.render("uni_login");
});






app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
});