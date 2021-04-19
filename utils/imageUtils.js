// Imports the Google Cloud client libraries
const vision = require("@google-cloud/vision");

// Creates a client
const client = new vision.ImageAnnotatorClient();

const getImageResults = async (imgBase64) => {
  const [result] = await client.faceDetection(imgBase64);
  const faces = result.faceAnnotations;
  console.log("Faces:");
  faces.forEach((face, i) => {
    console.log(`  Face #${i + 1}:`);
    console.log(`    Joy: ${face.joyLikelihood}`);
    console.log(`    Anger: ${face.angerLikelihood}`);
    console.log(`    Sorrow: ${face.sorrowLikelihood}`);
    console.log(`    Surprise: ${face.surpriseLikelihood}`);
  });
};

module.exports.getImageResults = getImageResults;
