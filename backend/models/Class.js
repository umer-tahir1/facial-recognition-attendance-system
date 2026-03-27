const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  name: { type: String, required: true }, // e.g. "Data Structures"
  code: { type: String, required: true }, // e.g. "CS-201"
  semester: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Class', classSchema);
