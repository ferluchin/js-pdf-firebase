
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();


// Take the text parameter passed to this HTTP endpoint and insert it into
// Firestore under the path /messages/:documentId/original
exports.addMessage = functions.https.onRequest(async (req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await admin.firestore().collection('messages').add({ original: original });
  // Send back a message that we've successfully written the message
  res.json({ result: `Message with ID: ${writeResult.id} added.` });
});


// FUNCION GENERAR PDF CON PDFMAKER

// Funcion https://medium.com/firebase-developers/how-to-generate-and-store-a-pdf-with-firebase-7faebb74ccbf

const Printer = require('pdfmake');
const fonts = require('pdfmake/build/vfs_fonts.js');

const fontDescriptors = {
  Roboto: {
    normal: Buffer.from(fonts.pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(fonts.pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(fonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(fonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
  }
};

exports.generatePdf = functions.https.onRequest(async (request, response) => {
  if (request.method !== "GET") {
    response.send(405, 'HTTP Method ' + request.method + ' not allowed');
    return null;
  }

  const printer = new Printer(fontDescriptors);
  const chunks = [];
  const docDefinition = {
    content: [
      // if you don't need styles, you can use a simple string to define a paragraph
      'This is a standard paragraph, using default style',
      // using a { text: '...' } object lets you set styling properties
      {
        text: 'This paragraph will have a bigger font',
        fontSize: 15
      },
      // if you set the value of text to an array instead of a string, you'll be able
      // to style any part individually
      {
        text: [
          'This paragraph is defined as an array of elements to make it possible to ',
          {
            text: 'restyle part of it and make it bigger ',
            fontSize: 15
          },
          'than the rest.'
        ]
      }
    ]
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  pdfDoc.on('data', (chunk) => {
    chunks.push(chunk);
  });

  // pdfDoc.on('end', () => {
  //   const result = Buffer.concat(chunks);
  //   response.setHeader('Content-Type', 'application/pdf');
  //   response.setHeader('Content-disposition', 'attachment; filename=report.pdf');
  //   response.send(result);
  // });

  pdfDoc.on('error', (err) => {
    response.status(501).send(err);
  });

  pdfDoc.end();

  // GUARDAR PDF EN FIREBASE STORAGE

  const bucket = admin.storage().bucket();


  pdfDoc.on('end', () => {
    const result = Buffer.concat(chunks);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-disposition',
      `attachment; filename=report.pdf`
    );

    // Upload generated file to the Cloud Storage
    const fileRef = bucket.file(
      `report2.pdf`,
      { metadata: { contentType: 'application/pdf' } }
    );
    fileRef.save(result);

    // Sending generated file as a response
    response.send(result);
  });



});

// PRUEBAS DE FIREBASE FUNCTIONS
// ZIP FUNCTION
//
//
//https://stackoverflow.com/questions/51563883/can-i-zip-files-in-firebase-storage-via-firebase-cloud-functions

// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
//const functions = require('firebase-functions');
//const admin = require('firebase-admin');

const archiver = require('archiver');
//const uuidv4 = require('uuid/v4');
const { v4: uuidv4 } = require('uuid');

//exports.createZip = functions.https.onCall(async () => {
exports.createZip = functions.https.onRequest(async () => {
  const storage = admin.storage();
  const bucket = storage.bucket('bucket-name');

  // generate random name for a file
  const filePath = uuidv4();
  const file = bucket.file(filePath);

  const outputStreamBuffer = file.createWriteStream({
    gzip: true,
    contentType: 'application/zip',
  });

  const archive = archiver('zip', {
    gzip: true,
    zlib: { level: 9 },
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(outputStreamBuffer);

  // use firestore, request data etc. to get file names and their full path in storage
  // file path can not start with '/'
  //const userFilePath = 'user-file-path';
  //gs://email-utpl.appspot.com/report2.pdf
  const userFilePath = 'gs://email-utpl.appspot.com/report2.pdf';
  //const userFileName = 'user-file-name';
  const userFileName = 'admin-file';


  const userFile = await bucket.file(userFilePath).download();
  archive.append(userFile[0], {
    name: userFileName, // if you want to have directory structure inside zip file, add prefix to name -> /folder/ + userFileName
  });

  archive.on('finish', async () => {
    console.log('uploaded zip', filePath);

    // get url to download zip file
    await bucket
      .file(filePath)
      .getSignedUrl({ expires: '03-09-2491', action: 'read' })
      .then((signedUrls) => console.log(signedUrls[0]));
  });

  await archive.finalize();
});

// PRUEBAS DE FIREBASE FUNCTIONS
// FUNCION PARA ENVIAR EMAIL
// https://stackoverflow.com/questions/48310441/firebase-cloud-functions-create-pdf-store-to-bucket-and-send-via-mail

const nodemailer = require("nodemailer");
const pdfkit = require("pdfkit");
//const storage = require("@google-cloud/storage")({ projectId: `${email-utpl}` })

const mailTransport = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secureConnection: false,
  auth: {
    user: "userName",
    pass: "userPassword"
  },
  tls: {
    ciphers: "SSLv3",
  }
});

exports.added = function (event) {
  const order = event.data.val();
  const userId = event.params.userId;

  // Load User Data by userId
  return admin.database().ref("/users/" + userId).once("value").then(function (snapshot) {
    return generatePDF(snapshot.val(), userId);
  });
};

function generatePDF(user, userId) {
  const doc = new pdfkit();
  const bucket = admin.storage().bucket(functions.config().moost.orderbucket);
  const filename = "/${userId}/attachement.pdf";
  const file = bucket.file(filename);
  const bucketFileStream = file.createWriteStream();
  var buffers = [];
  let p = new Promise((resolve, reject) => {
    doc.on("end", function () {
      resolve(buffers);
    });
    doc.on("error", function () {
      reject();
    });
  });

  doc.pipe(bucketFileStream);
  doc.on('data', buffers.push.bind(buffers));

  //Add Document Text and stuff

  doc.end();

  return p.then(function (buffers) {
    return sendMail(buffers);
  });
}

function sendMail(buffers) {
  const pdfData = Buffer.concat(buffers);
  const mailOptions = {
    from: "FromName <from@example.com>",
    to: "to@example.com",
    subject: "Subject",
    html: mailTemplate,
    attachments: [{
      filename: 'attachment.pdf',
      content: pdfData
    }]
  };

  return mailTransport.sendMail(mailOptions).then(() => {
    console.log("New email sent to:", "to@example.com");
  }).catch(error => {
    console.error(error);
  });
}
