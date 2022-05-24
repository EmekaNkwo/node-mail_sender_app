const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

const app = express();

dotenv.config();

const PORT = 3500;

//Static Path
app.use(express.static("public"));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Multer file storage Control
const Storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "./attachments");
  },
  filename: function (req, file, callback) {
    callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`);
  },
});

// Middleware to get a single attachment
const attachmentUpload = multer({
  storage: Storage,
}).single("attachment");

//nodemailer

// Pulling out OAuth2 from googleapis
const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
  // 1
  const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  // 2
  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  const accessToken = await new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err, token) => {
      if (err) {
        reject("Failed to create access token :( " + err);
      }
      resolve(token);
    });
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.SENDER_EMAIL,
      accessToken,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
    },
  });

  return transporter;
};

app.get("/", (req, res) => {
  res.sendFile("/index.html");
});

// Route to handle sending mails
app.post("/send-email", (req, res) => {
  attachmentUpload(req, res, async function (error) {
    if (error) {
      return res.send("Error uploading file");
    } else {
      // Pulling out the form data from the request body
      const recipient = req.body.email;
      const mailSubject = req.body.subject;
      const mailBody = req.body.message;
      const attachmentPath = req.file?.path;

      // Mail options
      let mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: recipient,
        subject: mailSubject,
        text: mailBody,
        attachments: [
          {
            path: attachmentPath,
          },
        ],
      };

      try {
        // Get response from the createTransport
        let emailTransporter = await createTransporter();

        // Send email
        emailTransporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            // failed block
            console.log(error);
          } else {
            // Success block
            console.log("Email sent: " + info.response);
            return res.redirect("/success.html");
          }
        });
      } catch (error) {
        return console.log(error);
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
