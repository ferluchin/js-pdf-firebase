
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
      `report2A.pdf`,
      { metadata: { contentType: 'application/pdf' } }
    );
    fileRef.save(result);

    // Sending generated file as a response
    response.send(result);

    const fileRefB = bucket.file(
      `report2B.pdf`,
      { metadata: { contentType: 'application/pdf' } }
    );
    fileRefB.save(result);

    // Sending generated file as a response
    response.send(result);

  });




});

