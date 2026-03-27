const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  classIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // Assuming an LMS allows multiple classes, or strictly 1 class group
  name: { type: String, required: true },
  registrationId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  profilePicture: { type: String },
  faceDescriptor: { type: [Number] }, // For facial recognition
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', studentSchema);
