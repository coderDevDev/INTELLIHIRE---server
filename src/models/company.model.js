const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    logo: String,
    description: String,
    industry: String,
    website: String,
    contactEmail: String,
    contactPhone: String,
    address: {
      street: String,
      city: String,
      province: String,
      zipCode: String
    },
    isGovernment: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
companySchema.index({ name: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ isGovernment: 1 });

module.exports = mongoose.model('Company', companySchema);
