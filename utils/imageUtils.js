// Imports the Google Cloud client libraries
const vision = require("@google-cloud/vision");

// Creates a client
const visionClient = new vision.ImageAnnotatorClient();
const getImageResults = async (imgBase64) => {
  let image = imgBase64,
    base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, ""),
    imageBuffer = new Buffer(base64EncodedImageString, "base64");

  const [result] = await visionClient.faceDetection({
    image: {
      content: imageBuffer,
    },
  });
  const faces = result.faceAnnotations;
  if (faces.length === 0) {
    return {
      absent: true,
    };
  }
  return {
    joy: faces[0].joyLikelihood,
    anger: faces[0].angerLikelihood,
    sorrow: faces[0].sorrowLikelihood,
    surprise: faces[0].surpriseLikelihood,
  };
};

module.exports.getImageResults = getImageResults;
