import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadFaceApiModels() {
  if (modelsLoaded) return;

  const MODEL_URL = '/models';

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);

    modelsLoaded = true;
    console.log('Face-api models loaded successfully');
  } catch (error) {
    console.error('Error loading face-api models:', error);
    throw error;
  }
}

export async function detectFaceFromImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection;
}

export async function detectMultipleFaces(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  const detections = await faceapi
    .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections;
}

export function compareFaces(descriptor1: Float32Array, descriptor2: Float32Array, threshold = 0.6) {
  const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
  return distance < threshold;
}

export function findBestMatch(queryDescriptor: Float32Array, labeledDescriptors: any[], threshold = 0.6) {
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  return faceMatcher.findBestMatch(queryDescriptor);
}

export function createLabeledDescriptors(students: any[]) {
  return students.map(student => {
    const descriptors = [new Float32Array(student.faceDescriptor)];
    return new faceapi.LabeledFaceDescriptors(student.studentId, descriptors);
  });
}

export async function recognizeFacesInClassroom(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  enrolledStudents: any[]
) {
  const detections = await detectMultipleFaces(imageElement);

  if (!detections || detections.length === 0) {
    return { recognized: [], unrecognized: 0 };
  }

  const labeledDescriptors = createLabeledDescriptors(enrolledStudents);
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

  const recognized: any[] = [];
  const recognizedIds = new Set<string>();

  detections.forEach((detection) => {
    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

    if (bestMatch.label !== 'unknown' && !recognizedIds.has(bestMatch.label)) {
      const student = enrolledStudents.find(s => s.studentId === bestMatch.label);
      if (student) {
        recognized.push({
          studentId: student.studentId,
          name: student.name,
          confidence: 1 - bestMatch.distance,
          detection: detection
        });
        recognizedIds.add(bestMatch.label);
      }
    }
  });

  return {
    recognized,
    unrecognized: detections.length - recognized.length,
    totalDetected: detections.length
  };
}
